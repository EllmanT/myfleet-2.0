/*
 * Query-level tenant guard (plan item A1).
 *
 * Route checks (requireOwnership) protect the routes someone remembered to protect.
 * This is the safety net underneath: every database call made while handling a
 * signed-in request is checked against the company that request belongs to.
 *
 * TENANT_GUARD controls it:
 *   off      (default) does nothing
 *   log      records every query on a company-owned collection that runs without
 *            naming the company; read them with getViolations() and fix the code
 *            (or opt out on purpose). Nothing is changed or blocked.
 *   enforce  adds the company to every such query, so a forgotten filter returns only
 *            the caller's own rows; saves are stamped, and a save for another company
 *            is refused. Turn this on only after backfillTenantId.js has stamped
 *            existing records, or older unstamped records will not be found.
 *
 * Platform admins and code running outside a request (scripts, tests, seeds) are
 * never touched. Use tenantContext.runUnscoped(fn) for a deliberate cross-company task.
 *
 * Not covered, on purpose: User, Deliverer, rate and ContractorStats (they have no
 * tenant field of their own and are guarded by their routes), and the inside of
 * $lookup stages (reported in log mode).
 */
const mongoose = require("mongoose");
const { current } = require("./tenantContext");

// model name -> the field that holds the owning company
const GUARDED = {
  Job: "tenantId",
  Vehicle: "tenantId",
  Driver: "tenantId",
  Customer: "tenantId",
  Contractor: "tenantId",
  VehicleStats: "tenantId",
  DriverStats: "tenantId",
  Invoice: "tenantId",
  Payment: "tenantId",
  Quotation: "tenantId",
  Trip: "tenantId",
  Trailer: "tenantId",
  ComplianceDoc: "tenantId",
  MaintenanceRecord: "tenantId",
  ServicePlan: "tenantId",
  Tyre: "tenantId",
  TyreFitment: "tenantId",
  AiUsage: "tenantId",
  Counter: "tenantId",
  Expense: "companyId",
  FuelFill: "companyId",
  OverallStats: "companyId",
  VehicleExpense: "companyId",
  employeeExpense: "companyId",
};

const QUERY_OPS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "countDocuments",
  "distinct",
];

const mode = () => String(process.env.TENANT_GUARD || "off").toLowerCase();

const violations = new Map();
function record(kind, modelName, op, ctx) {
  const key = `${kind} | ${modelName}.${op} | ${ctx.label || "(no route)"}`;
  const hit = violations.get(key);
  if (hit) {
    hit.count += 1;
    return;
  }
  violations.set(key, { kind, model: modelName, op, route: ctx.label || "", count: 1 });
  if (mode() === "log" && process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.warn(`[tenant-guard] ${kind}: ${modelName}.${op} in ${ctx.label || "(no route)"}`);
  }
}
const getViolations = () => [...violations.values()];
const resetViolations = () => violations.clear();

const isPlainObject = (v) =>
  v && typeof v === "object" && !v._bsontype && !(v instanceof Date) && !(v instanceof RegExp);

// Does this filter or pipeline stage mention `key` anywhere? Looks at keys only and
// samples long arrays, so a big $in list of ids costs nothing.
function mentionsKey(value, key, depth = 0) {
  if (depth > 6) return false;
  if (Array.isArray(value)) {
    return value.slice(0, 50).some((item) => isPlainObject(item) && mentionsKey(item, key, depth + 1));
  }
  if (!isPlainObject(value)) return false;
  for (const k of Object.keys(value)) {
    if (k === key) return true;
    if (mentionsKey(value[k], key, depth + 1)) return true;
  }
  return false;
}

// The guard applies to this request and this model, or not at all.
function activeFor(modelName) {
  const m = mode();
  if (m === "off") return null;
  const field = GUARDED[modelName];
  if (!field) return null;
  const ctx = current();
  if (!ctx || ctx.global) return null;
  return { m, field, ctx };
}

function castFor(schema, field, tenantId) {
  const type = schema.path(field) && schema.path(field).instance;
  return type === "ObjectId" ? new mongoose.Types.ObjectId(tenantId) : String(tenantId);
}

function guardQuery() {
  const a = activeFor(this.model.modelName);
  if (!a) return;
  const filter = this.getFilter();
  if (a.m === "log") {
    if (!mentionsKey(filter, a.field)) {
      record(mentionsKey(filter, "_id") ? "by-id" : "unscoped", this.model.modelName, this.op, a.ctx);
    }
    return;
  }
  // enforce: always add the caller's company (and keep whatever else was asked for)
  const scope = a.ctx.tenantId ? { [a.field]: a.ctx.tenantId } : { _id: { $in: [] } };
  this.setQuery({ $and: [scope, filter] });
}

function guardAggregate() {
  const model = this.model();
  const a = activeFor(model.modelName);
  if (!a) return;
  const pipeline = this.pipeline();
  const hasLookup = pipeline.some((stage) => stage && stage.$lookup);
  if (a.m === "log") {
    if (!pipeline.some((stage) => stage && stage.$match && mentionsKey(stage.$match, a.field))) {
      record("unscoped", model.modelName, "aggregate", a.ctx);
    }
    if (hasLookup) record("lookup-not-covered", model.modelName, "aggregate", a.ctx);
    return;
  }
  pipeline.unshift({
    $match: a.ctx.tenantId
      ? { [a.field]: castFor(model.schema, a.field, a.ctx.tenantId) }
      : { _id: { $in: [] } },
  });
  if (hasLookup) record("lookup-not-covered", model.modelName, "aggregate", a.ctx);
}

function guardSave(next) {
  const a = activeFor(this.constructor.modelName);
  if (!a) return next();
  if (!this.isNew && !this.isModified(a.field)) return next();
  const value = this.get(a.field);
  if (a.m === "log") {
    if (value == null) record("unstamped-save", this.constructor.modelName, "save", a.ctx);
    else if (a.ctx.tenantId && String(value) !== a.ctx.tenantId) {
      record("cross-tenant-save", this.constructor.modelName, "save", a.ctx);
    }
    return next();
  }
  if (!a.ctx.tenantId) return next(new Error("Your account has no company"));
  if (value == null) this.set(a.field, a.ctx.tenantId);
  else if (String(value) !== a.ctx.tenantId) {
    return next(new Error("Blocked: this record belongs to a different company"));
  }
  next();
}

function plugin(schema) {
  schema.pre(QUERY_OPS, { document: false, query: true }, guardQuery);
  schema.pre("aggregate", guardAggregate);
  schema.pre("save", guardSave);
}

let installed = false;
// Must run before any model is compiled (app.js does it first).
function install() {
  if (installed) return;
  installed = true;
  mongoose.plugin(plugin);
}

module.exports = { install, getViolations, resetViolations, GUARDED, mentionsKey, mode };
