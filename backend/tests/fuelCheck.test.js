const { analyseFills, weekRange, weekSummary, whatsappText, expectedKmpl } = require("../services/fuelCheck");

const fill = (day, odometer, litres, extra = {}) => ({
  filledAt: new Date(`2026-09-${day}T08:00:00Z`),
  odometer,
  litres,
  amount: litres * 1.95,
  fullTank: true,
  purpose: "business",
  photoPosted: true,
  ...extra,
});

describe("expectedKmpl", () => {
  test("uses the registration first, then the size", () => {
    expect(expectedKmpl({ regNumber: "AFE 5848", size: "mediumVehicle" })).toBe(7.4);
    expect(expectedKmpl({ regNumber: "ZZZ", size: "smallVehicle" })).toBe(9.6);
    expect(expectedKmpl({ regNumber: "ZZZ" })).toBe(8);
  });
});

describe("analyseFills", () => {
  test("normal use is OK", () => {
    // 96 km on 10 L = 9.6 km per litre
    const [a, b] = analyseFills([fill("01", 1000, 20), fill("08", 1096, 10)], 9.6);
    expect(a.kmpl).toBeNull();
    expect(b.kmpl).toBeCloseTo(9.6);
    expect(b.status).toBe("ok");
  });

  test("15 to 30 percent worse is CHECK, over 30 percent is REVIEW", () => {
    const [, check] = analyseFills([fill("01", 1000, 20), fill("08", 1100, 12)], 9.6); // 8.3 km/L, -13%? no: 100/12=8.33
    expect(check.status).toBe("ok"); // 13% worse, still inside the 15% band
    const [, c2] = analyseFills([fill("01", 1000, 20), fill("08", 1100, 13)], 9.6); // 7.69 = -20%
    expect(c2.status).toBe("check");
    const [, r] = analyseFills([fill("01", 1000, 20), fill("08", 1100, 18)], 9.6); // 5.56 = -42%
    expect(r.status).toBe("review");
    expect(r.flags.join(" ")).toMatch(/far more fuel/);
  });

  test("odometer going backwards is REVIEW", () => {
    const [, b] = analyseFills([fill("01", 1000, 20), fill("08", 990, 10)], 9.6);
    expect(b.status).toBe("review");
  });

  test("no km per litre unless both fills were full tanks", () => {
    const [, b] = analyseFills([fill("01", 1000, 20), fill("08", 1100, 10, { fullTank: false })], 9.6);
    expect(b.kmpl).toBeNull();
    expect(b.status).toBe("ok");
  });

  test("missing photos and a second fill the same day are flagged", () => {
    const [, b] = analyseFills(
      [fill("01", 1000, 20), { ...fill("01", 1020, 5), filledAt: new Date("2026-09-01T12:00:00Z"), photoPosted: false, fullTank: false }],
      9.6
    );
    expect(b.status).toBe("check");
    expect(b.flags.join(" ")).toMatch(/photos not posted/);
    expect(b.flags.join(" ")).toMatch(/Second fill/);
  });

  test("an unusual price per litre is flagged", () => {
    const rows = analyseFills([fill("01", 1000, 20), fill("08", 1096, 10), fill("15", 1192, 10, { amount: 40 })], 9.6);
    expect(rows[2].flags.join(" ")).toMatch(/Price per litre/);
  });
});

describe("weekly summary", () => {
  test("week runs Monday to Sunday", () => {
    const { start, end } = weekRange("2026-09-13T10:00:00Z"); // a Sunday
    expect(start.toISOString().slice(0, 10)).toBe("2026-09-07");
    expect(end.toISOString().slice(0, 10)).toBe("2026-09-14");
  });

  test("sums the week, keeps private fuel out of the cost, and writes WhatsApp text", () => {
    const analysed = analyseFills(
      [
        fill("06", 1000, 30),
        fill("13", 1096, 10), // Sunday of week 07-13
        fill("12", 1050, 4, { purpose: "private", fullTank: false }),
      ],
      9.6
    );
    const { start, end } = weekRange("2026-09-10T00:00:00Z");
    const s = weekSummary(analysed, start, end, 9.6);
    expect(s.fills).toBe(2);
    expect(s.litres).toBe(14);
    expect(s.amount).toBeCloseTo(19.5); // only the 10 L business fill
    expect(s.privateAmount).toBeCloseTo(7.8);
    const text = whatsappText(start, [{ name: "Toyota Dyna AFO0724", s }]);
    expect(text).toMatch(/Fuel check, week 2026-09-07 to 2026-09-13/);
    expect(text).toMatch(/Toyota Dyna AFO0724: 14 L/);
  });
});

describe("expectedKmpl per-vehicle value", () => {
  const { expectedKmpl } = require("../services/fuelCheck");
  test("a vehicle's own expectedKmPerLitre wins over registration and size defaults", () => {
    expect(expectedKmpl({ regNumber: "AFE5848", size: "horse", expectedKmPerLitre: 6.1 })).toBe(6.1);
  });
  test("falls back to the size default for any other company's truck", () => {
    expect(expectedKmpl({ regNumber: "ZZZ9999", size: "horse" })).toBe(3.5);
    expect(expectedKmpl({ regNumber: "ZZZ9999", size: "horse", expectedKmPerLitre: 0 })).toBe(3.5);
  });
});
