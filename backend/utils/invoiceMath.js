const DAY = 24 * 60 * 60 * 1000;

// Line amounts and totals, all in whole cents. Tax is a per-document percentage
// (0 by default); which rate applies is the company's decision, not ours.
function computeTotals(lines, taxRatePct = 0) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const taxCents = Math.round((subtotalCents * (Number(taxRatePct) || 0)) / 100);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

const lineAmount = (quantity, unitPriceCents) => Math.round(Number(quantity) * unitPriceCents);

const startOfUtcDay = (d = new Date()) =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

// What is still owed, whether it counts as paid, and whether it is late.
function paymentState(invoice, now = new Date()) {
  const credits = (invoice.creditNotes || []).reduce((s, c) => s + c.amountCents, 0);
  const balanceCents = Math.max(0, invoice.totalCents - (invoice.paidCents || 0) - credits);
  if (invoice.status !== "issued") {
    return { paymentStatus: invoice.status, balanceCents: invoice.status === "void" ? 0 : invoice.totalCents, creditCents: credits, overdue: false, daysOverdue: 0 };
  }
  const daysOverdue =
    invoice.dueDate && balanceCents > 0
      ? Math.floor((startOfUtcDay(now) - startOfUtcDay(new Date(invoice.dueDate))) / DAY)
      : 0;
  const paymentStatus =
    balanceCents === 0 ? "paid" : (invoice.paidCents || 0) > 0 || credits > 0 ? "partial" : "unpaid";
  return { paymentStatus, balanceCents, creditCents: credits, overdue: daysOverdue > 0, daysOverdue: Math.max(0, daysOverdue) };
}

// Ageing bucket for money that is owed: not yet due, then how late.
function ageBucket(daysOverdue) {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90_plus";
}

module.exports = { computeTotals, lineAmount, paymentState, ageBucket, startOfUtcDay };
