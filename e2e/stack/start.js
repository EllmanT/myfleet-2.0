/*
 * Throwaway full stack for the Playwright suite. One process:
 *   - an in-memory MongoDB (mongodb-memory-server), the only database the app ever sees
 *   - the real Express app from backend/app.js, unchanged
 *   - the CRA production build (e2e/.web-build, built WITHOUT a Clerk key = cookie login)
 *   - a localhost-only control API (/ctl/*) the tests use to create tenants and bend the clock
 *
 * Safety (see README "Why this cannot touch production"):
 *   - every variable named in backend/config/.env is blanked before the app loads, so real keys
 *     (database, Clerk, Blob, SMTP, Anthropic, cron) can never leak in
 *   - NODE_ENV is forced to "test"; the process refuses to start under anything else
 *   - the database URI must be a local mongodb-memory-server address, checked before connecting
 *   - the Clerk SDK is replaced by e2e/stack/clerk-stub.js through a require hook that exists
 *     only in this file
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..", "..");
const BACKEND = path.join(ROOT, "backend");
const WEB = path.join(ROOT, "e2e", ".web-build");
const PORT = Number(process.env.E2E_PORT || 5057);
const CTL_PORT = PORT + 1;
const CTL_TOKEN = process.env.E2E_CONTROL_TOKEN || "e2e-local-control-token";
const breq = Module.createRequire(path.join(BACKEND, "package.json"));

// ---- 1. environment hygiene -------------------------------------------------------------
if (process.env.NODE_ENV && /prod/i.test(process.env.NODE_ENV)) {
  console.error("[e2e] refusing to start: NODE_ENV looks like production");
  process.exit(1);
}
const envFile = path.join(BACKEND, "config", ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m) process.env[m[1]] = ""; // present-but-empty: dotenv will not overwrite it
  }
}
for (const k of Object.keys(process.env)) {
  if (/^(DB_URL|OFFLINE_DB_URL|MONGO|ATLAS|CLERK|NEXT_PUBLIC_CLERK|REACT_APP_CLERK|BLOB|VERCEL|SMPT|SMTP|ANTHROPIC|CRON|STRIPE)/.test(k)) {
    process.env[k] = "";
  }
}
const uploads = fs.mkdtempSync(path.join(os.tmpdir(), "myfleet-e2e-uploads-"));
Object.assign(process.env, {
  NODE_ENV: "test", // also switches the rate limiters off (middleware/security.js)
  PORT: String(PORT),
  JWT_SECRET_KEY: "e2e-jwt-secret",
  JWT_EXPIRES: "1d",
  ACTIVATION_SECRET: "e2e-activation-secret",
  FRONTEND_URL: `http://localhost:${PORT}`,
  ALLOWED_ORIGINS: `http://localhost:${PORT},http://127.0.0.1:${PORT}`,
  UPLOADS_DIR: uploads,
  LEGACY_LOGIN: "on", // the browser suite signs in with the cookie; production leaves this off
  TENANT_GUARD: process.env.TENANT_GUARD || "enforce", // what production should run
  DELETION_GRACE_DAYS: "30",
  // dummy keys only so clerkConfigured() is true and the Bearer path is active; the SDK is stubbed
  CLERK_SECRET_KEY: "sk_test_e2e_dummy",
  CLERK_PUBLISHABLE_KEY: "pk_test_e2e_dummy",
});
process.chdir(BACKEND);

// ---- 2. swap the Clerk SDK for the stub (this process only) ----------------------------
const clerk = require("./clerk-stub");
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "@clerk/express") return clerk.stub;
  return origLoad.call(this, request, ...rest);
};

async function main() {
  const { MongoMemoryServer } = breq("mongodb-memory-server");
  const mongoose = breq("mongoose");
  const express = breq("express");

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+/.test(uri)) throw new Error(`[e2e] unexpected database uri ${uri}`);
  await mongoose.connect(uri, { dbName: "myfleet_e2e" });
  console.log(`[e2e] throwaway database ${uri}`);

  const app = require(path.join(BACKEND, "app.js"));
  const Deliverer = require(path.join(BACKEND, "model", "deliverer"));
  const User = require(path.join(BACKEND, "model", "user"));
  const { MODULES } = require(path.join(BACKEND, "config", "modules"));
  const { newTenantBilling } = require(path.join(BACKEND, "config", "plans"));
  const { clearBillingCache } = require(path.join(BACKEND, "services", "billing"));
  const { clearModuleCache } = require(path.join(BACKEND, "middleware", "moduleAccess"));
  const { clearOrgCache } = require(path.join(BACKEND, "services", "clerkAuth"));
  const deletion = require(path.join(BACKEND, "services", "companyDeletion"));

  // ---- 3. the app: API from backend/app.js, SPA from the e2e build ----------------------
  const web = express();
  const isApi = (p) => p.startsWith("/api/") || p === "/test";
  web.use((req, res, next) => (isApi(req.path) ? app(req, res, next) : next()));
  if (fs.existsSync(path.join(WEB, "index.html"))) {
    web.use(express.static(WEB));
    web.get("*", (req, res) => res.sendFile(path.join(WEB, "index.html")));
  } else {
    web.get("*", (req, res) => res.status(503).send("e2e web build missing: run npm run build:web in e2e/"));
  }
  const webServer = http.createServer(web).listen(PORT);

  // ---- 4. control API (localhost only) -------------------------------------------------
  const ctl = express();
  ctl.use(express.json());
  ctl.use((req, res, next) => {
    if (req.headers["x-e2e-token"] !== CTL_TOKEN) return res.status(403).json({ error: "bad control token" });
    next();
  });
  const wrap = (fn) => (req, res) =>
    Promise.resolve(fn(req, res)).catch((e) => res.status(500).json({ error: e.message, stack: e.stack }));
  const oid = (v) => new mongoose.Types.ObjectId(String(v));
  const ALL_MODULES = Object.fromEntries(MODULES.filter((m) => m.available).map((m) => [m.key, true]));

  ctl.get("/ctl/health", (req, res) => res.json({ ok: true, uploads }));

  // Creates a company and its users straight in the database (the real signup path is Clerk-only).
  // billing: omitted = a fresh 30-day trial; null = legacy (no billing record); object = as given.
  ctl.post(
    "/ctl/tenant",
    wrap(async (req, res) => {
      const b = req.body || {};
      const billing = b.billing === undefined ? newTenantBilling() : b.billing;
      const company = await Deliverer.create({
        companyName: b.name,
        address: "1 Test Road",
        city: "Harare",
        goodsType: ["general"],
        vehiclesType: ["truck"],
        deliveryType: ["road"],
        modules: b.modules || ALL_MODULES,
        ...(billing ? { billing } : {}),
        ...(b.clerkOrgId ? { clerkOrgId: b.clerkOrgId } : {}),
      });
      const users = [];
      for (const u of b.users || []) {
        const doc = await User.create({
          name: u.name || "Test User",
          email: u.email,
          password: u.password,
          phoneNumber: "0770000000",
          address: "1 Test Road",
          city: "Harare",
          role: u.role || "Deliverer Admin",
          companyId: company._id,
        });
        company.admin_ids.push(doc._id);
        users.push({ id: String(doc._id), email: doc.email, role: doc.role });
      }
      await company.save();
      res.json({ companyId: String(company._id), users });
    })
  );

  // Platform admin (Super Admin / Site Admin), optionally with no company.
  ctl.post(
    "/ctl/platform-admin",
    wrap(async (req, res) => {
      const b = req.body;
      const doc = await User.create({
        name: b.name || "Platform Admin",
        email: b.email,
        password: b.password,
        phoneNumber: "0770000001",
        address: "1 Test Road",
        city: "Harare",
        role: b.role || "Super Admin",
        ...(b.companyId ? { companyId: oid(b.companyId) } : {}),
      });
      res.json({ id: String(doc._id) });
    })
  );

  // Sets a company's billing record directly and drops the 30s caches, so a test can move a
  // tenant to "trial ended" without waiting.
  ctl.post(
    "/ctl/billing",
    wrap(async (req, res) => {
      const { companyId, billing } = req.body;
      if (billing === null) await Deliverer.updateOne({ _id: oid(companyId) }, { $unset: { billing: 1 } });
      else await Deliverer.updateOne({ _id: oid(companyId) }, { $set: { billing } });
      clearBillingCache(companyId);
      res.json({ ok: true });
    })
  );

  ctl.post(
    "/ctl/deletion-date",
    wrap(async (req, res) => {
      const { companyId, scheduledFor } = req.body;
      await Deliverer.updateOne({ _id: oid(companyId) }, { $set: { deletionScheduledFor: new Date(scheduledFor) } });
      res.json({ ok: true });
    })
  );

  ctl.post(
    "/ctl/purge-due",
    wrap(async (req, res) => {
      res.json({ results: await deletion.purgeDueCompanies() });
    })
  );

  ctl.post(
    "/ctl/clear-caches",
    wrap(async (req, res) => {
      clearBillingCache();
      clearModuleCache();
      clearOrgCache();
      res.json({ ok: true });
    })
  );

  ctl.post(
    "/ctl/set-password",
    wrap(async (req, res) => {
      const u = await User.findOne({ email: req.body.email });
      if (!u) return res.status(404).json({ error: "no such user" });
      u.password = req.body.password;
      await u.save({ validateBeforeSave: false });
      res.json({ ok: true });
    })
  );

  // Fake Clerk directory (used with the stubbed SDK) and a way to mint a "session token".
  ctl.post("/ctl/clerk/user", (req, res) => {
    const b = req.body;
    clerk.users.set(b.userId, {
      firstName: b.firstName || "Test",
      lastName: b.lastName || "User",
      email: b.email,
      verified: b.verified !== false,
    });
    res.json({ ok: true });
  });
  ctl.post("/ctl/clerk/org", (req, res) => {
    clerk.orgs.set(req.body.orgId, { name: req.body.name });
    res.json({ ok: true });
  });
  ctl.post("/ctl/clerk/token", (req, res) => res.json({ token: clerk.mintToken(req.body) }));

  // Read-only look at the database, for "nothing changed / nothing leaked" checks.
  // snapshot: every document that belongs to a company (tenantId / companyId / its own _id).
  ctl.post(
    "/ctl/snapshot",
    wrap(async (req, res) => {
      const id = oid(req.body.companyId);
      const idStr = String(id);
      const db = mongoose.connection.db;
      const out = {};
      for (const { name } of await db.listCollections().toArray()) {
        const docs = await db
          .collection(name)
          .find({ $or: [{ tenantId: id }, { tenantId: idStr }, { companyId: id }, { companyId: idStr }, { _id: id }] })
          .sort({ _id: 1 })
          .toArray();
        if (docs.length) out[name] = docs.map((d) => JSON.stringify(d));
      }
      res.json(out);
    })
  );
  const toFilter = (filter = {}) => {
    const f = {};
    for (const [k, v] of Object.entries(filter)) {
      f[k] = /(^_id$|Id$|^tenantId$)/.test(k) && /^[0-9a-f]{24}$/.test(String(v)) ? oid(v) : v;
    }
    return f;
  };
  ctl.post(
    "/ctl/count",
    wrap(async (req, res) => {
      const { collection, filter } = req.body;
      res.json({ count: await mongoose.connection.db.collection(collection).countDocuments(toFilter(filter)) });
    })
  );
  ctl.post(
    "/ctl/find",
    wrap(async (req, res) => {
      const { collection, filter, limit = 20 } = req.body;
      const docs = await mongoose.connection.db.collection(collection).find(toFilter(filter)).limit(limit).toArray();
      res.json({ docs: JSON.parse(JSON.stringify(docs)) });
    })
  );

  const ctlServer = http.createServer(ctl).listen(CTL_PORT, "127.0.0.1");

  const stop = async () => {
    webServer.close();
    ctlServer.close();
    await mongoose.disconnect().catch(() => {});
    await mongod.stop().catch(() => {});
    fs.rmSync(uploads, { recursive: true, force: true });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.log(`[e2e] ready: web http://localhost:${PORT}  control http://127.0.0.1:${CTL_PORT}`);
}

main().catch((e) => {
  console.error("[e2e] failed to start", e);
  process.exit(1);
});
