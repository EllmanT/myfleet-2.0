/*
 * Cross-tenant isolation matrix.
 *
 * Company A is the full demo company. Company B is a second, empty company with an
 * admin. As B, this test calls EVERY route the app exposes (discovered from the
 * Express router, so a route added later is covered automatically) using A's ids in
 * the path, the body and the query string, then checks two things:
 *   1. no response contains anything that belongs to A (its ids, names, emails)
 *   2. nothing A owns was changed or deleted
 *
 * A route that returns A's data to B, or lets B change it, fails this test.
 * Routes that cannot be probed this way are listed in SKIPPED with the reason.
 */
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.ACTIVATION_SECRET = process.env.ACTIVATION_SECRET || "test-activation";
process.env.NODE_ENV = "test";

const app = require("../app");
const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const { seedDemo } = require("../scripts/seedDemoTenant");

jest.setTimeout(600000);

// Routes that are public by design, send email, or call an outside service.
const SKIPPED = [
  /\/user\/login-user$/,
  /\/user\/create-user$/,
  /\/user\/activation$/,
  /\/user\/forgot-password$/,
  /\/user\/reset-password$/,
  /\/user\/logout$/,
  /\/auth\/bootstrap$/,
  /\/ai-import\/(read|extract)/, // calls the AI provider
];

// Which collections hold the records a route family works on.
const DOMAIN = [
  [/\/vehicleStats\//, ["vehicles", "vehiclestats"]],
  [/\/driverStats\//, ["drivers", "driverstats"]],
  [/\/contractorStats\//, ["contractors", "contractorstats"]],
  [/\/overallStats\//, ["overallstats", "deliverers"]],
  [/\/expenses\/vehicle/, ["vehicleexpenses", "vehicles"]],
  [/\/expenses\/employee/, ["employeeexpenses", "drivers"]],
  [/\/expense\//, ["expenses", "vehicles"]],
  [/\/fuel\//, ["fuelfills", "vehicles"]],
  [/\/vehicle\//, ["vehicles"]],
  [/\/driver\//, ["drivers"]],
  [/\/customer\//, ["customers"]],
  [/\/contractor\//, ["contractors"]],
  [/\/job-import\//, ["jobs", "customers", "vehicles"]],
  [/\/job\//, ["jobs", "contractors", "vehicles", "drivers", "customers"]],
  [/\/trip\//, ["trips", "trailers", "vehicles", "drivers"]],
  [/\/trailer\//, ["trailers"]],
  [/\/invoice\//, ["invoices", "customers", "jobs", "trips"]],
  [/\/payment\//, ["payments", "invoices", "customers"]],
  [/\/quotation\//, ["quotations", "customers"]],
  [/\/compliance\//, ["compliancedocs", "vehicles", "drivers", "trailers"]],
  [/\/maintenance\//, ["serviceplans", "maintenancerecords", "tyres", "tyrefitments", "vehicles", "trailers"]],
  [/\/deliverer\//, ["deliverers"]],
  [/\/user\//, ["users", "deliverers"]],
  [/\/rate\//, ["rates", "deliverers"]],
  [/\/tenant\//, ["deliverers"]],
];

// Param names that tell us exactly which kind of id to use.
const PARAM = {
  contractorId: ["contractors"],
  vehicleId: ["vehicles"],
  driverId: ["drivers"],
  employeeId: ["drivers"],
  customerId: ["customers"],
  jobId: ["jobs"],
  companyId: ["deliverers"],
  delivererId: ["deliverers"],
  tenantId: ["deliverers"],
  adminId: ["users"],
  userId: ["users"],
  expenseId: ["vehicleexpenses", "expenses"],
  tripId: ["trips"],
  invoiceId: ["invoices"],
  paymentId: ["payments"],
  quotationId: ["quotations"],
};

function listRoutes(expressApp) {
  const out = [];
  const walk = (stack, prefix) => {
    for (const layer of stack) {
      if (layer.route) {
        if (typeof layer.route.path !== "string") continue;
        for (const method of Object.keys(layer.route.methods)) {
          out.push({ method: method.toUpperCase(), path: prefix + layer.route.path });
        }
      } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
        const mount = layer.regexp.source
          .replace("\\/?(?=\\/|$)", "")
          .replace(/^\^/, "")
          .replace(/\\\//g, "/");
        walk(layer.handle.stack, prefix + mount);
      }
    }
  };
  walk(expressApp._router.stack, "");
  return out.filter((r) => r.path.startsWith("/api/"));
}

const hex = (v) => (v && v.toString ? v.toString() : String(v));

describe("tenant isolation matrix", () => {
  let mongod;
  let idsByCollection; // collection -> [A's ids]
  let aStrings; // everything that must never appear in B's responses
  let aBefore; // JSON of every A-owned document before probing
  let aTenantId;
  let bToken;
  let aToken;

  const snapshotA = async () => {
    const db = mongoose.connection.db;
    const snap = {};
    for (const [coll, ids] of Object.entries(idsByCollection)) {
      const docs = await db
        .collection(coll)
        .find({ _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) } })
        .toArray();
      for (const d of docs) snap[`${coll}:${hex(d._id)}`] = JSON.stringify(d);
    }
    return snap;
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const seeded = await seedDemo(mongoose, { today: new Date("2026-11-03T00:00:00Z"), seed: 7 });
    aTenantId = hex(seeded.tenantId);

    // A's own records for the families the demo seed does not fill
    const db = mongoose.connection.db;
    const aVehicle = await db.collection("vehicles").findOne({ tenantId: seeded.tenantId });
    const aDriver = await db.collection("drivers").findOne({ tenantId: seeded.tenantId });
    await db.collection("vehicleexpenses").insertOne({
      companyId: aTenantId,
      vehicleId: hex(aVehicle._id),
      description: "A-ONLY-SECRET-VEHICLE-EXPENSE",
      amount: 123,
    });
    await db.collection("employeeexpenses").insertOne({
      companyId: aTenantId,
      employeeId: hex(aDriver._id),
      description: "A-ONLY-SECRET-EMPLOYEE-EXPENSE",
      amount: 45,
    });

    // gather everything A owns
    idsByCollection = {};
    aStrings = new Set([aTenantId, "A-ONLY-SECRET-VEHICLE-EXPENSE", "A-ONLY-SECRET-EMPLOYEE-EXPENSE", "demo@myfleet.app", "Kudu Haulage"]);
    const collections = (await db.listCollections().toArray()).map((c) => c.name);
    for (const name of collections) {
      const docs = await db.collection(name).find({}).toArray();
      if (!docs.length) continue;
      idsByCollection[name] = docs.map((d) => hex(d._id));
      for (const d of docs) {
        aStrings.add(hex(d._id));
        for (const key of ["name", "companyName", "regNumber", "email", "customerName", "idNumber", "registration"]) {
          if (typeof d[key] === "string" && d[key].length >= 5) aStrings.add(d[key]);
        }
      }
    }
    aBefore = await snapshotA();

    const aUser = await db.collection("users").findOne({ companyId: { $in: [seeded.tenantId, aTenantId] } });
    aToken = jwt.sign({ id: hex(aUser._id) }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });

    // company B: new, empty, with an admin
    const b = await Deliverer.create({
      companyName: "Company B",
      address: "B Street",
      city: "Bulawayo",
      goodsType: ["general"],
      vehiclesType: ["small"],
      deliveryType: ["standard"],
    });
    const bUser = await User.create({
      name: "B Admin",
      email: "admin@company-b.test",
      password: "password123",
      phoneNumber: "555",
      role: "Deliverer Admin",
      address: "B Street",
      city: "Bulawayo",
      companyId: b._id,
    });
    bToken = jwt.sign({ id: bUser._id }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });
    // B's own names and ids are legitimate in B's responses
    aStrings.delete(hex(b._id));
  }, 180000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("company B cannot read or change anything company A owns", async () => {
    const routes = listRoutes(app).filter((r) => !SKIPPED.some((rx) => rx.test(r.path)));
    expect(routes.length).toBeGreaterThan(80); // sanity: discovery worked

    const leaks = [];
    const note = (route, how, detail) => leaks.push(`${route.method} ${route.path} [${how}] ${detail}`);

    const candidatesFor = (route, paramName) => {
      const named = PARAM[paramName];
      const domain = (DOMAIN.find(([rx]) => rx.test(route.path + "/")) || [null, []])[1];
      const cols = named || domain.length ? named || domain : Object.keys(idsByCollection);
      const ids = [];
      for (const c of cols) for (const id of (idsByCollection[c] || []).slice(0, 2)) ids.push(id);
      if (cols.includes("deliverers") || !ids.length) ids.push(aTenantId);
      return [...new Set(ids)];
    };

    const scan = (route, how, res) => {
      const text = JSON.stringify(res.body || {}) + (typeof res.text === "string" ? res.text : "");
      for (const s of aStrings) {
        if (text.includes(s)) {
          note(route, how, `status ${res.status} exposes A's "${s.slice(0, 40)}"`);
          return;
        }
      }
    };

    for (const route of routes) {
      const params = [...route.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
      // one probe per candidate id for the first param; other params use their first candidate
      const firstSet = params.length ? candidatesFor(route, params[0]) : [null];
      const probes = params.length ? firstSet : [null];
      for (const cand of probes) {
        let url = route.path;
        for (const p of params) {
          const id = p === params[0] ? cand : candidatesFor(route, p)[0];
          url = url.replace(`:${p}`, id || "000000000000000000000000");
        }
        const domainIds = candidatesFor(route, null);
        const pick = cand || domainIds[0] || aTenantId;
        const body = {};
        for (const k of [
          "id", "jobId", "driverId", "vehicleId", "contractorId", "customerId", "compId", "expenseId",
          "employeeId", "tripId", "invoiceId", "quotationId", "paymentId", "trailerId", "assetId", "planId",
          "recordId", "tyreId", "docId",
        ]) body[k] = pick;
        const spoof = { companyId: aTenantId, tenantId: aTenantId, delivererId: aTenantId };

        const variants =
          route.method === "GET"
            ? [
                ["plain", url, undefined],
                ["spoofed", `${url}${url.includes("?") ? "&" : "?"}companyId=${aTenantId}&tenantId=${aTenantId}&delivererId=${aTenantId}&year=2026&page=0&pageSize=200`, undefined],
              ]
            : [["with A's ids", url, { ...body, ...spoof }]];

        for (const [how, u, payload] of variants) {
          let res;
          try {
            let req = request(app)[route.method.toLowerCase()](u).set("Cookie", ["token=" + bToken]);
            if (payload) req = req.send(payload);
            res = await req;
          } catch (e) {
            note(route, how, "request threw: " + e.message.slice(0, 80));
            continue;
          }
          if (res.status >= 500) note(route, how, `server error ${res.status}: ${(res.body && res.body.message) || ""}`.slice(0, 160));
          scan(route, how, res);
        }
      }
    }

    // nothing A owns may have changed or disappeared
    const aAfter = await snapshotA();
    for (const key of Object.keys(aBefore)) {
      if (!(key in aAfter)) leaks.push(`DELETED ${key}`);
      else if (aAfter[key] !== aBefore[key]) leaks.push(`CHANGED ${key}`);
    }

    // eslint-disable-next-line no-console
    console.log(`probed ${routes.length} routes; ${leaks.length} problem(s)\n` + [...new Set(leaks)].join("\n"));
    expect([...new Set(leaks)]).toEqual([]);
  });

  // Positive control: the same probes, made by A itself, must see A's data. If they
  // did not, "B saw nothing" above could just mean the probes were pointing at nothing.
  test("the probes can see data when company A asks for its own", async () => {
    const routes = listRoutes(app).filter(
      (r) => r.method === "GET" && !r.path.includes(":") && !SKIPPED.some((rx) => rx.test(r.path))
    );
    let withData = 0;
    for (const route of routes) {
      const res = await request(app)
        .get(`${route.path}?page=0&pageSize=200&year=2026`)
        .set("Cookie", ["token=" + aToken]);
      const text = JSON.stringify(res.body || {});
      if ([...aStrings].some((s) => text.includes(s))) withData += 1;
    }
    // eslint-disable-next-line no-console
    console.log(`company A saw its own data on ${withData} of ${routes.length} list routes`);
    expect(withData).toBeGreaterThanOrEqual(15);
  });
});
