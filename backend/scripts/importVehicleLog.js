/**
 * Imports per-vehicle trip logs (Excel) as jobs. LOCAL DB ONLY.
 *
 *   node scripts/importVehicleLog.js                 # dry run on "excel uploads/"
 *   node scripts/importVehicleLog.js <file|dir>...   # dry run on specific files
 *   node scripts/importVehicleLog.js --commit        # actually write
 *
 * Options:
 *   --choices <file.json>   override decisions: { "<decision key>": "<value>" }
 *                           (keys are printed in the review section)
 *   --full-compound         treat "LAMMEL / SHIPPY" as one place instead of
 *                           defaulting to the first name
 *   --company <delivererId> needed only if the DB has several deliverers
 *   --json <out.json>       also write the full preview as JSON
 *
 * Uses exactly the same preview/commit code as the "Import from Excel" page,
 * so a clean dry run here means the upload will behave the same.
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", "config", ".env") });

const Deliverer = require("../model/deliverer");
const { buildImportPreview } = require("../services/jobImport/buildImportPreview");
const { commitImport } = require("../services/jobImport/commitImport");

const DEFAULT_DIR = path.resolve(__dirname, "..", "excel uploads");

function parseArgs(argv) {
  const args = { paths: [], commit: false, fullCompound: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--commit") args.commit = true;
    else if (arg === "--full-compound") args.fullCompound = true;
    else if (arg === "--choices") args.choices = argv[++i];
    else if (arg === "--company") args.company = argv[++i];
    else if (arg === "--json") args.json = argv[++i];
    else args.paths.push(arg);
  }
  return args;
}

function collectFiles(paths) {
  const targets = paths.length ? paths : [DEFAULT_DIR];
  return targets.flatMap((target) => {
    const full = path.resolve(target);
    if (fs.statSync(full).isDirectory()) {
      return fs
        .readdirSync(full)
        .filter((name) => /\.(xlsx|xls)$/i.test(name) && !name.startsWith("~$"))
        .map((name) => path.join(full, name));
    }
    return [full];
  });
}

const money = (value) => `$${Number(value).toFixed(2)}`;

function printPreview(preview) {
  console.log("\n=== Sheets ===");
  preview.sheets.forEach((sheet) => {
    const note = sheet.skipped
      ? `SKIPPED: ${sheet.reason}`
      : `reg ${sheet.regNumber || "?"}, contractor column: ${sheet.contractorColumn || "none"}, ${sheet.rowCount} rows`;
    console.log(`- ${sheet.fileName} [${sheet.sheetName}] ${note}`);
  });

  console.log("\n=== Matches (★ = please review) ===");
  preview.decisions.forEach((d) => {
    const chosen = d.options.find((o) => o.value === d.value);
    const label = chosen ? chosen.label : d.value || "— not matched —";
    const flag = d.needsReview ? "★" : " ";
    console.log(`${flag} ${d.kind.padEnd(10)} ${d.raw.padEnd(20)} → ${label}  (${d.status})`);
    if (d.needsReview) {
      console.log(`      key: ${JSON.stringify(d.key)}`);
      console.log(
        `      options: ${d.options.map((o) => `${o.label} = ${JSON.stringify(o.value)}`).join(" | ")}`
      );
    }
  });

  console.log("\n=== Jobs to create ===");
  preview.jobs.forEach((job) => {
    console.log(
      `${job.jobNumber.padEnd(8)} ${job.date}  ${job.regNumber}  ${job.driverName.padEnd(8)} ${job.contractorName.padEnd(15)} ${job.deliveryType.padEnd(8)} ${job.route.join(" → ")}  ${job.distance} km  ${money(job.cost)} @ ${money(job.rate)}/km`
    );
  });

  const notReady = preview.legs.filter((leg) => leg.status !== "ready");
  if (notReady.length) {
    console.log("\n=== Rows not imported ===");
    notReady.forEach((leg) =>
      console.log(
        `[${leg.sheetName}] row ${String(leg.rowNumber).padEnd(4)} ${leg.status.padEnd(9)} ${leg.fromRaw} → ${leg.toRaw}: ${leg.reason}`
      )
    );
  }
  const warned = preview.legs.filter((leg) => leg.warnings.length);
  if (warned.length) {
    console.log("\n=== Warnings ===");
    warned.forEach((leg) => console.log(`row ${leg.rowNumber}: ${leg.warnings.join("; ")}`));
  }

  if (preview.newCustomerNames.length) {
    console.log(`\nNew customers to create: ${preview.newCustomerNames.join(", ")}`);
  }
  const s = preview.summary;
  console.log(
    `\nSummary: ${s.jobs} jobs / ${s.ready} legs, ${s.distance} km, ${money(s.cost)} | skipped ${s.skipped}, duplicates ${s.duplicate}, errors ${s.error}, blocked ${s.blocked}, to review ${s.toReview}`
  );
}

async function resolveCompanyId(explicit) {
  if (explicit) return explicit;
  const deliverers = await Deliverer.find({}).select("companyName").lean();
  if (deliverers.length !== 1) {
    throw new Error(
      `Found ${deliverers.length} deliverers — pass --company <id>: ${deliverers
        .map((d) => `${d.companyName}=${d._id}`)
        .join(", ")}`
    );
  }
  return deliverers[0]._id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.MONGO_URI_LOCAL || process.env.OFFLINE_DB_URL;
  if (!dbUrl) throw new Error("Set OFFLINE_DB_URL (local Mongo) in config/.env");

  const filePaths = collectFiles(args.paths);
  if (!filePaths.length) throw new Error("No .xlsx files found");
  const files = filePaths.map((filePath) => ({
    fileName: path.basename(filePath),
    buffer: fs.readFileSync(filePath),
  }));
  const choices = args.choices ? JSON.parse(fs.readFileSync(args.choices, "utf8")) : {};
  const options = { useFirstNameForCompound: !args.fullCompound };

  await mongoose.connect(dbUrl);
  console.log(`DB: ${mongoose.connection.host}/${mongoose.connection.name} (local)`);
  try {
    const companyId = await resolveCompanyId(args.company);

    let started = Date.now();
    const preview = await buildImportPreview({ files, companyId, choices, options });
    printPreview(preview);
    console.log(`Preview built in ${Date.now() - started} ms`);
    if (args.json) fs.writeFileSync(args.json, JSON.stringify(preview, null, 2));

    if (!args.commit) {
      console.log("\nDry run — nothing written. Re-run with --commit to import.");
      return;
    }

    started = Date.now();
    const result = await commitImport({ files, companyId, choices, options });
    console.log(
      `\nImported ${result.jobsCreated} jobs (${result.legsCreated} legs) in ${Date.now() - started} ms.`
    );
    if (result.newCustomers.length) {
      console.log(`Created customers: ${result.newCustomers.join(", ")}`);
    }
    result.jobs.forEach((job) =>
      console.log(`  ${job.jobNumber}  ${job.date}  ${job.route.join(" → ")}  ${money(job.cost)}`)
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`\nImport failed: ${error.message}`);
  process.exitCode = 1;
});
