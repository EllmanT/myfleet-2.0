const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Adds cost totals and the margin to a trip for display.
// The margin is price minus the costs that are in the trip's own currency. If any
// cost is in another currency, the margin is not computed (no guessing at an
// exchange rate); `mixedCurrency` tells the app to say so.
function withTotals(trip) {
  const t = typeof trip.toObject === "function" ? trip.toObject() : trip;
  const lines = t.costLines || [];
  const costsByCurrency = {};
  lines.forEach((l) => {
    const c = l.currency || "USD";
    costsByCurrency[c] = round2((costsByCurrency[c] || 0) + Number(l.amount || 0));
  });
  const currency = t.currency || "USD";
  const otherCurrencies = Object.keys(costsByCurrency).filter((c) => c !== currency);
  const mixedCurrency = otherCurrencies.length > 0;
  const totalCosts = costsByCurrency[currency] || 0;
  return {
    ...t,
    costsByCurrency,
    totalCosts: round2(totalCosts),
    mixedCurrency,
    margin: mixedCurrency ? null : round2(Number(t.price || 0) - totalCosts),
  };
}

// A trip is cross-border when its stops span more than one country.
function detectCrossBorder(stops) {
  const countries = new Set(
    (stops || []).map((s) => String(s.country || "").trim().toUpperCase()).filter(Boolean)
  );
  return countries.size > 1;
}

module.exports = { withTotals, detectCrossBorder, round2 };
