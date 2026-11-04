/*
 * Company data export (plan H4).
 *
 * One ZIP with everything a company entered into myFleet, in formats that open anywhere:
 *   README.txt            what is in the file
 *   manifest.json         when, by whom, and how many rows of each kind
 *   csv/<name>.csv        one flat table per kind (opens in Excel; UTF-8 with a BOM)
 *   json/<name>.json      the same rows with every field, exactly as stored
 *   documents/...         uploaded files (driver licences and IDs)
 *
 * Left out on purpose: passwords and sign-in secrets, other companies' data, and numbers the
 * app can recalculate from the rows above (dashboard statistics, counters, AI usage).
 *
 * The ZIP is streamed to the caller, so a large company does not need to fit in memory and the
 * response is not capped by the serverless 4.5 MB limit for buffered responses.
 */
const mongoose = require("mongoose");
const { Zip, ZipDeflate, ZipPassThrough, strToU8 } = require("fflate");
const { readFile, isStoredKey } = require("./fileStorage");

const reqModel = (file) => require(`../model/${file}`);

// scope: the field holding the owning company. ids: the Deliverer array that also lists the
// company's records, used for older records that were never stamped.
const KINDS = [
  { name: "jobs", model: "job", scope: "tenantId", ids: "job_ids", note: "Jobs / loads" },
  { name: "customers", model: "customer", scope: "tenantId", ids: "customer_ids", note: "Customers" },
  { name: "vehicles", model: "vehicle", scope: "tenantId", ids: "vehicle_ids", note: "Trucks and vehicles" },
  { name: "drivers", model: "driver", scope: "tenantId", ids: "driver_ids", note: "Drivers", files: ["license", "id"] },
  { name: "contractors", model: "contractor", scope: "tenantId", ids: "contractor_ids", note: "Contractors" },
  { name: "trailers", model: "trailer", scope: "tenantId", note: "Trailers" },
  { name: "trips", model: "trip", scope: "tenantId", note: "Trips" },
  { name: "invoices", model: "invoice", scope: "tenantId", note: "Invoices" },
  { name: "payments", model: "payment", scope: "tenantId", note: "Payments received" },
  { name: "quotations", model: "quotation", scope: "tenantId", note: "Quotations" },
  { name: "compliance-documents", model: "complianceDoc", scope: "tenantId", note: "Compliance documents and expiry dates" },
  { name: "maintenance-records", model: "maintenanceRecord", scope: "tenantId", note: "Maintenance records" },
  { name: "service-plans", model: "servicePlan", scope: "tenantId", note: "Service plans" },
  { name: "tyres", model: "tyre", scope: "tenantId", note: "Tyres" },
  { name: "tyre-fitments", model: "tyreFitment", scope: "tenantId", note: "Tyre fitments" },
  { name: "expenses", model: "expense", scope: "companyId", note: "Expenses" },
  { name: "fuel", model: "fuelFill", scope: "companyId", note: "Fuel fills" },
  { name: "vehicle-expenses", model: "vehicleExpense", scope: "companyId", note: "Vehicle expenses" },
  { name: "employee-expenses", model: "employeeExpenses", scope: "companyId", note: "Employee expenses" },
];

const USER_SECRETS = "-password -resetPasswordToken -resetPasswordExpire -clerkUserId -__v";

// ---------- flattening for CSV ----------

const isObjectId = (v) => v && typeof v === "object" && (v._bsontype === "ObjectId" || v._bsontype === "ObjectID");

function cell(value) {
  if (value === null || value === undefined) return "";
  if (isObjectId(value)) return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || ["string", "number", "boolean"].includes(typeof v) || isObjectId(v))) {
      return value.map((v) => (isObjectId(v) ? String(v) : v)).join("; ");
    }
    return JSON.stringify(jsonSafe(value));
  }
  if (typeof value === "object") return JSON.stringify(jsonSafe(value));
  return String(value);
}

// ObjectIds and Dates already stringify properly in JSON; this only drops internals.
function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (k, v) => (k === "__v" ? undefined : v)));
}

// A spreadsheet runs a cell that starts with = + - @ as a formula. Real text we hold (a customer
// called "=cmd...") must not become one, but plain negative numbers must stay numbers.
function csvField(text) {
  let s = text;
  if (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-?\d+(\.\d+)?$/.test(s))) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  const lines = [columns.map(csvField).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvField(cell(row[c]))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---------- gathering a company's rows ----------

async function rowsFor(kind, company) {
  const Model = reqModel(kind.model);
  const clauses = [];
  if (kind.scope === "tenantId") {
    clauses.push({ tenantId: company._id });
  } else {
    // companyId was stored as text in some places and as an id in others. Mongoose would turn
    // the text into an id and miss the text rows, so this asks the collection directly.
    clauses.push({ [kind.scope]: { $in: [company._id, String(company._id)] } });
  }
  if (kind.ids && company[kind.ids] && company[kind.ids].length) {
    clauses.push({ _id: { $in: company[kind.ids] } });
  }
  const filter = clauses.length === 1 ? clauses[0] : { $or: clauses };
  // Always the raw collection: the filter above is the company's own, and raw rows are exported
  // exactly as stored.
  return Model.collection.find(filter).sort({ _id: 1 }).toArray();
}

async function userRows(company) {
  const User = reqModel("user");
  return User.find({ companyId: company._id }).select(USER_SECRETS).sort({ _id: 1 }).lean();
}

function companyRow(company) {
  const copy = { ...company };
  delete copy.__v;
  delete copy.clerkOrgId;
  return copy;
}

const README = (company, exportedAt, counts, documentCount) => `myFleet data export
====================
Company:  ${company.companyName}
Exported: ${exportedAt}

This is a copy of the information your company entered into myFleet.

csv/        One spreadsheet per kind of record. Open them in Excel or Google Sheets.
            Where a cell holds a list, the items are separated by "; ".
            Where a cell holds a detailed record, it is written as JSON text.
json/       The same records with every field exactly as stored. Use these to move
            your data into another system.
documents/  Files you uploaded (driver licences and ID documents).
manifest.json  The date, and how many records of each kind are included.

Not included: passwords and sign-in details, and dashboard totals, which myFleet
works out again from the records above.

Records: ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ")}
Documents: ${documentCount}
`;

/**
 * Stream the export to `out` (anything with write(Buffer) and end()).
 * Returns the manifest once finished.
 */
async function streamCompanyExport({ companyId, requestedBy, out, onError }) {
  const Deliverer = reqModel("deliverer");
  const company = await Deliverer.findById(companyId).lean();
  if (!company) {
    const error = new Error("Company not found");
    error.status = 404;
    throw error;
  }

  const exportedAt = new Date().toISOString();
  const counts = {};
  const missingDocuments = [];
  let documentCount = 0;

  let finished;
  const done = new Promise((resolve, reject) => {
    finished = { resolve, reject };
  });
  const zip = new Zip((err, chunk, final) => {
    if (err) return finished.reject(err);
    out.write(Buffer.from(chunk));
    if (final) {
      out.end();
      finished.resolve();
    }
  });

  const addText = (name, text) => {
    const file = new ZipDeflate(name, { level: 6 });
    zip.add(file);
    file.push(strToU8(text), true);
  };

  try {
    const sections = [];
    for (const kind of KINDS) {
      const rows = await rowsFor(kind, company);
      sections.push({ kind, rows });
    }
    sections.push({ kind: { name: "users", note: "People who can sign in" }, rows: await userRows(company) });
    sections.push({ kind: { name: "company", note: "Company profile" }, rows: [companyRow(company)] });

    for (const { kind, rows } of sections) {
      counts[kind.name] = rows.length;
      addText(`csv/${kind.name}.csv`, toCsv(rows));
      addText(`json/${kind.name}.json`, JSON.stringify(jsonSafe(rows), null, 2));
    }

    // Uploaded documents, one at a time so memory stays small.
    for (const { kind, rows } of sections) {
      if (!kind.files) continue;
      for (const row of rows) {
        for (const field of kind.files) {
          const key = row[field];
          if (!isStoredKey(key)) continue;
          const stored = await readFile(key);
          if (!stored) {
            missingDocuments.push({ kind: kind.name, record: String(row._id), field });
            continue;
          }
          const chunks = [];
          for await (const part of stored.stream) chunks.push(Buffer.from(part));
          const ext = key.split(".").pop();
          const entry = new ZipPassThrough(`documents/${kind.name}/${row._id}-${field}.${ext}`);
          zip.add(entry);
          entry.push(new Uint8Array(Buffer.concat(chunks)), true);
          documentCount += 1;
        }
      }
    }

    const manifest = {
      company: { id: String(company._id), name: company.companyName },
      exportedAt,
      requestedBy: requestedBy ? String(requestedBy) : null,
      counts,
      documents: documentCount,
      documentsNotFound: missingDocuments,
    };
    addText("manifest.json", JSON.stringify(manifest, null, 2));
    addText("README.txt", README(company, exportedAt, counts, documentCount));
    zip.end();
    await done;
    return manifest;
  } catch (error) {
    try {
      zip.terminate();
    } catch (_) {
      /* already closed */
    }
    if (onError) onError(error);
    throw error;
  }
}

module.exports = { streamCompanyExport, KINDS, toCsv, csvField };
