// Pure functions for the weekly fuel check (no database access, easy to test).
//
// Idea: fill the tank to full every time. Then the litres put in at a fill are the fuel
// used since the previous full fill, so  km per litre = km driven / litres.
// Compare that with what the truck normally does.

const EXPECTED_KMPL_BY_SIZE = { smallVehicle: 9.6, mediumVehicle: 7.4, largeVehicle: 5.0, horse: 3.5 };
const EXPECTED_KMPL_BY_REG = { AFE5848: 7.4, AAV4331: 9.6, AFO0724: 9.6 };
const CHECK_PCT = 0.15; // 15% worse than normal: ask for an explanation
const REVIEW_PCT = 0.3; // 30% worse than normal: review with the owner

const expectedKmpl = (vehicle) =>
  EXPECTED_KMPL_BY_REG[String(vehicle.regNumber || "").replace(/\s/g, "").toUpperCase()] ||
  EXPECTED_KMPL_BY_SIZE[vehicle.size] ||
  8;

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const RANK = { ok: 0, check: 1, review: 2 };
const worst = (a, b) => (RANK[b] > RANK[a] ? b : a);

// fills: one vehicle's fills (plain objects), any order. Returns the same fills, oldest first,
// each with { km, kmpl, variancePct, status, flags[] }.
function analyseFills(fills, expected) {
  const sorted = [...fills].sort((a, b) => new Date(a.filledAt) - new Date(b.filledAt));
  const prices = sorted.map((f) => f.amount / f.litres).filter((p) => Number.isFinite(p) && p > 0);
  const typical = median(prices);

  return sorted.map((f, i) => {
    const prev = sorted[i - 1];
    const out = { ...f, km: null, kmpl: null, variancePct: null, status: "ok", flags: [] };
    const flag = (text, level) => {
      out.flags.push(text);
      out.status = worst(out.status, level);
    };

    if (prev) {
      const km = f.odometer - prev.odometer;
      if (km <= 0) {
        flag("Odometer did not go up since the last fill", "review");
      } else {
        out.km = km;
        if (f.fullTank && prev.fullTank) {
          out.kmpl = km / f.litres;
          out.variancePct = (out.kmpl / expected - 1) * 100;
          if (out.kmpl < expected * (1 - REVIEW_PCT)) {
            flag(`Used far more fuel than normal (${out.kmpl.toFixed(1)} km per litre, normal ${expected})`, "review");
          } else if (out.kmpl < expected * (1 - CHECK_PCT)) {
            flag(`Used more fuel than normal (${out.kmpl.toFixed(1)} km per litre, normal ${expected})`, "check");
          } else if (out.kmpl > expected * (1 + REVIEW_PCT)) {
            flag("Very good km per litre. Check the odometer and litres were written correctly", "check");
          }
        }
      }
      const hours = (new Date(f.filledAt) - new Date(prev.filledAt)) / 36e5;
      if (hours >= 0 && hours < 12) flag("Second fill within 12 hours", "check");
    }
    if (!f.photoPosted) flag("Pump and odometer photos not posted", "check");
    const p = f.amount / f.litres;
    if (typical && Math.abs(p / typical - 1) > 0.15) flag(`Price per litre ($${p.toFixed(2)}) is unusual`, "check");
    return out;
  });
}

// Monday 00:00 (UTC) to next Monday 00:00 for the week containing `date`.
function weekRange(date) {
  const d = new Date(date);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const end = new Date(start.getTime() + 7 * 864e5);
  return { start, end };
}

// Summary for one vehicle for one week. allAnalysed = analyseFills() result for the whole history.
function weekSummary(allAnalysed, start, end, expected) {
  const inWeek = allAnalysed.filter((f) => new Date(f.filledAt) >= start && new Date(f.filledAt) < end);
  const before = allAnalysed.filter((f) => new Date(f.filledAt) < start).pop();
  let status = "ok";
  inWeek.forEach((f) => (status = worst(status, f.status)));

  const litres = inWeek.reduce((t, f) => t + f.litres, 0);
  const business = inWeek.filter((f) => f.purpose !== "private");
  const amount = business.reduce((t, f) => t + f.amount, 0);
  const privateAmount = inWeek.filter((f) => f.purpose === "private").reduce((t, f) => t + f.amount, 0);
  const measured = inWeek.filter((f) => f.kmpl !== null);
  const kmMeasured = measured.reduce((t, f) => t + f.km, 0);
  const litresMeasured = measured.reduce((t, f) => t + f.litres, 0);
  const kmpl = litresMeasured ? kmMeasured / litresMeasured : null;
  const startOdo = (before || inWeek[0] || {}).odometer;
  const endOdo = inWeek.length ? inWeek[inWeek.length - 1].odometer : null;
  return {
    fills: inWeek.length,
    litres: Math.round(litres * 10) / 10,
    amount: Math.round(amount * 100) / 100,
    privateAmount: Math.round(privateAmount * 100) / 100,
    km: startOdo != null && endOdo != null ? endOdo - startOdo : null,
    kmpl: kmpl ? Math.round(kmpl * 10) / 10 : null,
    expectedKmpl: expected,
    // litres the truck should have used for the km measured, versus what was put in
    expectedLitres: kmMeasured ? Math.round((kmMeasured / expected) * 10) / 10 : null,
    litresMeasured: Math.round(litresMeasured * 10) / 10,
    status,
    flags: [...new Set(inWeek.flatMap((f) => f.flags))],
  };
}

const STATUS_TEXT = { ok: "OK", check: "CHECK", review: "REVIEW" };

// Short plain text for the WhatsApp group.
function whatsappText(start, perVehicle) {
  const day = (d) => d.toISOString().slice(0, 10);
  const end = new Date(start.getTime() + 6 * 864e5);
  const lines = [`Fuel check, week ${day(start)} to ${day(end)}`];
  let litres = 0, amount = 0;
  perVehicle.forEach(({ name, s }) => {
    litres += s.litres; amount += s.amount;
    if (!s.fills) {
      lines.push(`${name}: no fill this week`);
      return;
    }
    const km = s.km != null ? `${s.km} km` : "km not known";
    const eff = s.kmpl != null ? `${s.kmpl} km/L (normal ${s.expectedKmpl})` : "km/L not measured (tank not full both times)";
    lines.push(`${name}: ${s.litres} L, $${s.amount.toFixed(2)}, ${km}, ${eff} - ${STATUS_TEXT[s.status]}`);
  });
  lines.push(`Total: ${Math.round(litres * 10) / 10} L, $${amount.toFixed(2)}`);
  return lines.join("\n");
}

module.exports = { analyseFills, weekRange, weekSummary, whatsappText, expectedKmpl, CHECK_PCT, REVIEW_PCT };
