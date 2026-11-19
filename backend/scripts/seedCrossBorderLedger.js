/*
 * Seeds the 18 cross-border ledger trips (AL.01 - AL.18) that were photographed from
 * Allea WorldWide's handwritten ledger (cross-border-trips/*.jpeg, May - Oct 2026).
 *
 * IMPORTANT - these rows are a best reading of low-resolution, sideways photos:
 *   - price is 0 on every row: the Price column was not legible. Fill it in later.
 *   - row-to-row alignment of the client/supplier columns is uncertain, so each trip
 *     carries notes saying so and source = "ledger-photo-seed" (easy to find/clean up).
 *   - the right-hand columns are the driver (MOTION) and the truck plate (A.H.E 0144);
 *     every trip is linked to that driver and truck.
 *
 * Safe by design: dry run unless --apply; target is explicit (--target=local is the default,
 * --target=live also needs --confirm-live); the company is found BY NAME in the chosen
 * database; it only ever creates the 18 trips, plus driver "Motion" and truck AHE0144 if
 * missing; idempotent (keyed on tenant + clientRef / name / reg); it never edits or deletes
 * anything else, and never overwrites a trip you have since changed.
 *
 * Usage (from backend/):
 *   node scripts/seedCrossBorderLedger.js                          dry run on local
 *   node scripts/seedCrossBorderLedger.js --apply                  write to local
 *   node scripts/seedCrossBorderLedger.js --target=live --apply --confirm-live
 *   node scripts/seedCrossBorderLedger.js --remove                 delete only source=ledger-photo-seed trips
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
const mongoose = require("mongoose");

const COMPANY = "Allea WorldWide";
const SOURCE = "ledger-photo-seed";

// [ref, date, from, to, cargo, client, supplier, extra note]
const Z = "Zim", S = "SA";
const ROWS = [
  ["AL.01", "2026-05-10", ["Harare", Z], ["Mutare", Z], "Drinks", "Kayreed", "", ""],
  ["AL.02", "2026-05-14", ["Mutare", Z], ["Jobeg", S], "Boards", "Thando", "Sakunda", ""],
  ["AL.03", "2026-05-23", ["Jobeg", S], ["Gwanda", Z], "Fertilizer", "Thanda", "Sakunda", "destination read as Gwanda - uncertain"],
  ["AL.04", "2026-05-27", ["Jobeg", S], ["Lupane", Z], "Fertiliser", "Golden Smile", "Golden Smile", ""],
  ["AL.05", "2026-06-11", ["Polokwane", S], ["Lupane", Z], "Chrome", "B.L.D", "P.G. Bison", ""],
  ["AL.06", "2026-07-03", ["Zvishavane", Z], ["Jobeg", S], "Boards", "Natural Stone", "Natural Stone", "date read as 3/7 - uncertain"],
  ["AL.07", "2026-07-13", ["Jobeg", S], ["Harare", Z], "Granite slabs", "B.L.N", "P.G. Bison", ""],
  ["AL.08", "2026-07-17", ["Musina", Z], ["Jobeg", S], "Boards", "Natural Stone", "Natural Stone", "date read as 17/7 - uncertain"],
  ["AL.09", "2026-07-22", ["Jobeg", S], ["Harare", Z], "Granite slabs", "Tendo", "Various", ""],
  ["AL.10", "2026-08-05", ["Musina", Z], ["Jobeg", S], "Console", "Natural Stone", "Natural Stone", ""],
  ["AL.11", "2026-08-12", ["Jobeg", S], ["Harare", Z], "Granite slabs", "Various", "Various", "date read as 12/8 - uncertain"],
  ["AL.12", "2026-09-14", ["Musina", Z], ["Jobeg", S], "Console", "Natural Stones", "Natural Stone", "route also written Bulawayo - Harare / SA"],
  ["AL.13", "2026-09-21", ["Jobeg", S], ["Harare", Z], "Granite slabs", "", "", "client and supplier not legible"],
  ["AL.14", "2026-10-02", ["Musina", Z], ["Jobeg", S], "", "", "", "cargo, client and supplier blank on the sheet; date read as 2/10"],
  ["AL.15", "2026-10-04", ["Harare", Z], ["Harare", ""], "Fertiliser / Windmill", "Winmill / Z.F.C", "Z.F.C", "written LOCAL, 3 trips; date read as 4/10"],
  ["AL.16", "2026-10-14", ["Musina", Z], ["Jobeg", S], "Granite slabs", "Natural Stone", "Natural Stone", ""],
  ["AL.17", "2026-10-20", ["Jobeg", S], ["Harare", Z], "Fertiliser", "Thando", "Sakunda", ""],
  ["AL.18", "2026-10-26", ["Musina", Z], ["Jobeg", S], "Granite slabs", "Natural Stone", "Natural Stone", ""],
];

const TBC = "To confirm";
const DRIVER = "Motion";
const PLATE = "AHE0144";

function buildTrip(tenantId, row, ids) {
  const [ref, date, from, to, cargo, client, supplier, extra] = row;
  const stops = [from, to].map(([place, country]) => ({ place, country }));
  const countries = new Set(stops.map((s) => s.country).filter(Boolean));
  const notes = [
    "Seeded from the handwritten ledger photo; price not legible, set to 0 - to be added.",
    "Client/supplier columns may be misaligned by a row; please verify. Driver: Motion. Truck: AHE 0144.",
    extra,
  ].filter(Boolean).join(" ");
  return {
    tenantId,
    clientRef: ref,
    date: new Date(`${date}T00:00:00.000Z`),
    status: "delivered",
    transporterName: "Allea",
    customerName: client || TBC,
    supplierName: supplier,
    stops,
    isCrossBorder: countries.size > 1,
    cargoDescription: cargo,
    price: 0,
    currency: "USD",
    notes,
    horseId: ids.vehicleId,
    driverId: ids.driverId,
    source: SOURCE,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const remove = process.argv.includes("--remove");
  const target = (process.argv.find((a) => a.startsWith("--target=")) || "--target=local").split("=")[1];
  let url;
  if (target === "live") {
    if (!process.argv.includes("--confirm-live")) throw new Error("Writing to live needs --confirm-live");
    url = process.env.MONGO_URI_LIVE;
    if (!url) throw new Error("MONGO_URI_LIVE is not set");
  } else if (target === "local") {
    url = process.env.OFFLINE_DB_URL;
    if (!url || !/(127\.0\.0\.1|localhost)/.test(url)) {
      throw new Error("Refusing: OFFLINE_DB_URL is missing or not a local database.");
    }
  } else throw new Error("--target must be local or live");
  await mongoose.connect(url);
  console.log(`target: ${target}`);
  const Trip = require("../model/trip");
  const Deliverer = require("../model/deliverer");

  const company = await Deliverer.findOne({ companyName: COMPANY }).select("_id").lean();
  if (!company) throw new Error(`Company "${COMPANY}" not found in ${mongoose.connection.name}`);
  console.log(`database: ${mongoose.connection.name}   company: ${COMPANY} (${company._id})`);

  if (remove) {
    const r = await Trip.deleteMany({ tenantId: company._id, source: SOURCE });
    console.log(`removed ${r.deletedCount} seeded trips`);
    return;
  }

  // driver and truck: find by name / plate inside this company, create only if missing
  const Vehicle = require("../model/vehicle");
  const Driver = require("../model/driver");
  const cid = String(company._id);
  let vehicle = await Vehicle.findOne({ companyId: cid, regNumber: { $regex: /^AHE\s?0144$/i } });
  let driver = await Driver.findOne({ companyId: cid, name: { $regex: /^motion$/i } });
  console.log(`truck ${PLATE}: ${vehicle ? "exists" : apply ? "creating" : "would create"}   driver ${DRIVER}: ${driver ? "exists" : apply ? "creating" : "would create"}`);
  if (apply && !vehicle) {
    vehicle = await Vehicle.create({ tenantId: company._id, companyId: cid, regNumber: PLATE, make: "To confirm", size: "largeVehicle" });
  }
  if (apply && !driver) {
    driver = await Driver.create({
      tenantId: company._id, companyId: cid, name: DRIVER,
      phoneNumber: "To confirm", address: "To confirm", city: "To confirm", idNumber: "To confirm", id: "To confirm",
    });
  }
  const ids = { vehicleId: vehicle && vehicle._id, driverId: driver && driver._id };

  let created = 0, existing = 0;
  for (const row of ROWS) {
    const doc = buildTrip(company._id, row, ids);
    const found = await Trip.findOne({ tenantId: company._id, clientRef: doc.clientRef }).select("_id").lean();
    if (found) {
      existing++;
      // earlier seeded trips: only fill a missing driver/truck, never overwrite
      if (apply && ids.vehicleId) {
        await Trip.updateOne({ _id: found._id, source: SOURCE, horseId: { $exists: false } }, { $set: { horseId: ids.vehicleId, driverId: ids.driverId } });
      }
      if (apply) {
        // refresh the note text only where it is still the old seeded wording
        await Trip.updateOne(
          { _id: found._id, source: SOURCE, notes: /not yet understood/ },
          { $set: { notes: doc.notes } }
        );
      }
      console.log(`  keep   ${doc.clientRef} (already exists${apply ? ", driver/truck filled if missing" : ""})`);
      continue;
    }
    console.log(`  ${apply ? "create" : "would create"} ${doc.clientRef}  ${row[1]}  ${row[2][0]} -> ${row[3][0]}  ${doc.cargoDescription || "-"}  | ${doc.customerName}${doc.isCrossBorder ? "  [cross-border]" : ""}`);
    if (apply) await Trip.create(doc);
    created++;
  }
  console.log(`${apply ? "created" : "would create"} ${created}, already present ${existing}${apply ? "" : "   (dry run - add --apply to write)"}`);
}

main()
  .catch((e) => { console.error("ERROR:", e.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
