/*
 * Emails about the trial and payment clock. Run daily by the cron. Each notice is sent once per
 * clock date: we remember which trialEndsAt / paidUntil it was sent for, so extending a trial or
 * recording a payment makes the next notice possible again, and a re-run never double-sends.
 * Legacy companies (no billing record) and suspended/cancelled ones get nothing.
 */
const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const sendMail = require("../utils/sendMail");
const { BANDS, billingState, PAYMENT_GRACE_DAYS, PAYMENT_ECOCASH } = require("../config/plans");

const DAY = 86400000;
const ENDING_SOON_DAYS = 7;
const AUTO_DELETE_AFTER_DAYS = 30; // read-only for this long, then the normal cooling-off countdown starts

// Pure: which notices apply to this billing record right now, with the date each is "for".
function noticesDue(billing, now = new Date()) {
  if (!billing || !billing.band) return [];
  if (billing.status === "suspended" || billing.status === "cancelled") return [];
  const s = billingState(billing, now);
  const out = [];
  if (billing.status === "trial" || !billing.status) {
    const anchor = billing.trialEndsAt ? new Date(billing.trialEndsAt).toISOString() : null;
    if (!anchor) return [];
    if (s.state === "trial" && s.daysLeft <= ENDING_SOON_DAYS) out.push({ kind: "trial_ending", anchor, daysLeft: s.daysLeft });
    if (s.state === "read_only") out.push({ kind: "trial_ended", anchor });
  } else if (billing.status === "active" && billing.paidUntil) {
    const anchor = new Date(billing.paidUntil).toISOString();
    if (s.daysLeft !== null && s.daysLeft <= 3 && s.daysLeft >= 0) out.push({ kind: "payment_due", anchor, daysLeft: s.daysLeft });
    if (s.state === "read_only") out.push({ kind: "payment_overdue", anchor });
  }
  return out;
}

// When the company last had full use: the end of the trial, or the end of the payment grace.
function readOnlySince(billing) {
  if (!billing || !billing.band) return null;
  if (billing.status === "trial") return billing.trialEndsAt ? new Date(billing.trialEndsAt) : null;
  if (billing.status === "active" && billing.paidUntil) return new Date(new Date(billing.paidUntil).getTime() + PAYMENT_GRACE_DAYS * DAY);
  return null;
}

// Pure: has this company been read-only (not suspended or cancelled by us) long enough to start deletion?
function shouldAutoDelete(billing, now = new Date()) {
  const s = billingState(billing, now);
  if (s.state !== "read_only") return false;
  const since = readOnlySince(billing);
  return Boolean(since) && now.getTime() - since.getTime() >= AUTO_DELETE_AFTER_DAYS * DAY;
}

function compose(kind, company, notice) {
  const band = BANDS[company.billing.band];
  const plan = `${band.label} (USD ${band.priceUsd} a month)`;
  const hello = `Hello,\n\n`;
  const sign = `\nPay by EcoCash to ${PAYMENT_ECOCASH} and put "${company.companyName}" as the reference, or reply to this email for bank transfer details. We confirm your payment by reply and the account opens straight away.\n\nmyFleet`;
  const safe = "Your data is safe, and you can always view it and download a full copy.";
  const days = (n) => (n === 1 ? "1 day" : `${n} days`);
  switch (kind) {
    case "trial_ending":
      return {
        subject: `Your myFleet trial ends in ${days(Math.max(notice.daysLeft, 0))}`,
        message: `${hello}The free trial for ${company.companyName} ends in ${days(Math.max(notice.daysLeft, 0))}. Your plan is ${plan}.\n\nAfter the trial the account becomes read-only: you can still look at everything and download it, but you cannot add or change anything until you subscribe.${sign}`,
      };
    case "trial_ended":
      return {
        subject: "Your myFleet trial has ended",
        message: `${hello}The free trial for ${company.companyName} has ended, so the account is now read-only. ${safe}\n\nTo carry on adding jobs, invoices and the rest, subscribe to ${plan}.${sign}`,
      };
    case "payment_due":
      return {
        subject: `Your myFleet subscription is due in ${days(notice.daysLeft)}`,
        message: `${hello}The subscription for ${company.companyName} (${plan}) is due in ${days(notice.daysLeft)}.${sign}`,
      };
    case "deletion_scheduled":
      return {
        subject: "Your myFleet account is scheduled for deletion",
        message: `${hello}${company.companyName} has been read-only for ${AUTO_DELETE_AFTER_DAYS} days, so we have scheduled the account and all its data for deletion on ${new Date(notice.scheduledFor).toDateString()}.

To keep it, just pay: the deletion is cancelled automatically the moment the account is active again. To keep a copy of your records, sign in and download them from the Modules page.${sign}`,
      };
    default:
      return {
        subject: "Your myFleet payment is overdue",
        message: `${hello}The subscription for ${company.companyName} is overdue and the account is now read-only. ${safe}\n\nOnce payment is received it opens straight away.${sign}`,
      };
  }
}

// Companies we scheduled for deletion ourselves are taken off the list as soon as they can write again.
async function cancelAutoDeletionsForPaidUp(now = new Date()) {
  const pending = await Deliverer.find({ deletionAuto: true, deletionScheduledFor: { $exists: true } }).lean();
  const cancelled = [];
  for (const c of pending) {
    if (billingState(c.billing, now).writable) {
      await Deliverer.updateOne(
        { _id: c._id },
        { $unset: { deletionScheduledFor: 1, deletionRequestedAt: 1, deletionRequestedBy: 1, deletionAuto: 1 } }
      );
      cancelled.push({ company: String(c._id), kind: "auto_deletion_cancelled" });
    }
  }
  return cancelled;
}

async function startOverdueDeletions(now, mailer) {
  const days = Number(process.env.DELETION_GRACE_DAYS);
  const grace = Number.isFinite(days) && days >= 0 ? days : 30;
  const out = [];
  const candidates = await Deliverer.find({ "billing.band": { $exists: true }, deletionScheduledFor: { $exists: false } }).lean();
  for (const c of candidates) {
    if (!shouldAutoDelete(c.billing, now)) continue;
    const scheduledFor = new Date(now.getTime() + grace * DAY);
    await Deliverer.updateOne({ _id: c._id }, { $set: { deletionRequestedAt: now, deletionScheduledFor: scheduledFor, deletionAuto: true } });
    const owners = await User.find({ companyId: c._id, role: "Deliverer Admin" }).select("email").lean();
    const { subject, message } = compose("deletion_scheduled", c, { scheduledFor });
    for (const o of owners) {
      try {
        await mailer({ email: o.email, subject, message });
      } catch (e) {
        out.push({ company: String(c._id), kind: "deletion_scheduled", to: o.email, error: e.message });
      }
    }
    out.push({ company: String(c._id), kind: "deletion_scheduled", scheduledFor });
  }
  return out;
}

async function sendDueNotices(now = new Date(), mailer = sendMail) {
  const results = await cancelAutoDeletionsForPaidUp(now);
  results.push(...(await startOverdueDeletions(now, mailer)));
  const companies = await Deliverer.find({ "billing.band": { $exists: true }, deletionScheduledFor: { $exists: false } }).lean();
  for (const company of companies) {
    const sent = (company.billing && company.billing.notices) || {};
    for (const notice of noticesDue(company.billing, now)) {
      if (sent[notice.kind] === notice.anchor) continue;
      const owners = await User.find({ companyId: company._id, role: "Deliverer Admin" }).select("email").lean();
      if (!owners.length) continue;
      const { subject, message } = compose(notice.kind, company, notice);
      let delivered = 0;
      for (const o of owners) {
        try {
          await mailer({ email: o.email, subject, message });
          delivered += 1;
        } catch (e) {
          results.push({ company: String(company._id), kind: notice.kind, to: o.email, error: e.message });
        }
      }
      if (delivered) {
        await Deliverer.updateOne({ _id: company._id }, { $set: { [`billing.notices.${notice.kind}`]: notice.anchor } });
        results.push({ company: String(company._id), kind: notice.kind, sent: delivered });
      }
    }
  }
  return results;
}

module.exports = { shouldAutoDelete, AUTO_DELETE_AFTER_DAYS, noticesDue, compose, sendDueNotices, ENDING_SOON_DAYS, PAYMENT_GRACE_DAYS, DAY };
