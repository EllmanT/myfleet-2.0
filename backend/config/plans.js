/*
 * Plans, trials and what each state allows. Prices are a launch test and WILL change, so they
 * live here and nowhere else: never write a price in a component or an email.
 *
 * A company with no `billing` record at all (every company that existed before billing, i.e. the
 * first customer) is "legacy": always active, no limits. That is deliberate, so adding billing
 * cannot lock an existing customer out.
 */
const DAY = 24 * 60 * 60 * 1000;

const BANDS = {
  starter: { label: "1-2 trucks", maxTrucks: 2, priceUsd: 9, trialDays: 30, maxUsers: 3, aiPagesPerMonth: 50 },
  fleet: { label: "3-10 trucks", maxTrucks: 10, priceUsd: 29, trialDays: 60, maxUsers: 10, aiPagesPerMonth: 200 },
  pro: { label: "11-25 trucks", maxTrucks: 25, priceUsd: 59, trialDays: 90, maxUsers: 25, aiPagesPerMonth: 500 },
};
const BAND_ORDER = ["starter", "fleet", "pro"];
const MAX_TRUCKS = BANDS.pro.maxTrucks;
const PAYMENT_GRACE_DAYS = 7; // after paidUntil passes, still writable this long

// Smallest band that fits this many trucks, or null above the largest ("contact us").
function bandForTrucks(count) {
  const n = Number(count) || 0;
  return BAND_ORDER.find((b) => n <= BANDS[b].maxTrucks) || null;
}

function newTenantBilling(now = new Date(), band = "starter") {
  return { band, status: "trial", trialEndsAt: new Date(now.getTime() + BANDS[band].trialDays * DAY) };
}

/*
 * What a company may do right now. Pure: the same record and time always give the same answer.
 * state:    legacy | trial | active | read_only | suspended | cancelled
 * writable: may create and change data
 * export is always allowed whatever the state (it is a read).
 */
function billingState(billing, now = new Date()) {
  if (!billing || !billing.band) {
    return { state: "legacy", band: null, writable: true, readOnlyReason: null, daysLeft: null, limits: null };
  }
  const band = BANDS[billing.band] ? billing.band : "starter";
  const limits = BANDS[band];
  const t = now.getTime();
  const out = { band, limits, trialEndsAt: billing.trialEndsAt || null, paidUntil: billing.paidUntil || null };

  if (billing.status === "suspended") return { ...out, state: "suspended", writable: false, readOnlyReason: "suspended", daysLeft: null };
  if (billing.status === "cancelled") return { ...out, state: "cancelled", writable: false, readOnlyReason: "cancelled", daysLeft: null };

  if (billing.status === "active") {
    const paid = billing.paidUntil ? new Date(billing.paidUntil).getTime() : null;
    if (paid === null) return { ...out, state: "active", writable: true, readOnlyReason: null, daysLeft: null };
    const daysLeft = Math.ceil((paid - t) / DAY);
    if (t <= paid + PAYMENT_GRACE_DAYS * DAY) return { ...out, state: "active", writable: true, readOnlyReason: null, daysLeft };
    return { ...out, state: "read_only", writable: false, readOnlyReason: "payment_overdue", daysLeft };
  }

  // trial
  const end = billing.trialEndsAt ? new Date(billing.trialEndsAt).getTime() : 0;
  const daysLeft = Math.ceil((end - t) / DAY);
  if (t <= end) return { ...out, state: "trial", writable: true, readOnlyReason: null, daysLeft };
  return { ...out, state: "read_only", writable: false, readOnlyReason: "trial_ended", daysLeft };
}

module.exports = { BANDS, BAND_ORDER, MAX_TRUCKS, PAYMENT_GRACE_DAYS, bandForTrucks, newTenantBilling, billingState };
