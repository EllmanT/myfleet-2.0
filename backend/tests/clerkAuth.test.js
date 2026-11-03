const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Clerk's network calls can't run in tests, so the SDK is replaced by a stub
// whose getAuth result each test controls.
const mockAuth = { current: null };
jest.mock("@clerk/express", () => ({
  clerkMiddleware: () => (req, res, next) => next(),
  getAuth: () => mockAuth.current,
  clerkClient: {},
}));

process.env.CLERK_SECRET_KEY = "sk_test_dummy";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_dummy";
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
process.env.NODE_ENV = "test";

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const {
  resolveLocalIdentity,
  clearOrgCache,
} = require("../services/clerkAuth");
const app = require("../app");

describe("Clerk identity linking", () => {
  let mongod;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 60000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    clearOrgCache();
    mockAuth.current = null;
  });

  const legacyAdmin = async () => {
    const company = await Deliverer.create({
      companyName: "Allea",
      address: "a",
      city: "c",
      goodsType: ["g"],
      vehiclesType: ["v"],
      deliveryType: ["d"],
    });
    const user = await User.create({
      name: "Owner",
      email: "Owner@Test.com",
      password: "password123",
      phoneNumber: "1",
      role: "Deliverer Admin",
      address: "a",
      city: "c",
      companyId: company._id,
    });
    return { company, user };
  };

  test("brand-new signup gets their own empty company and admin role", async () => {
    const r = await resolveLocalIdentity({
      clerkUserId: "user_new",
      email: "new@test.com",
      emailVerified: true,
      name: "New Person",
      orgId: "org_new",
      orgName: "New Haulage",
      orgRole: "org:admin",
    });
    expect(r.company.companyName).toBe("New Haulage");
    expect(r.company.clerkOrgId).toBe("org_new");
    expect(r.user.role).toBe("Deliverer Admin");
    expect(String(r.user.companyId)).toBe(String(r.company._id));
    expect(r.user.password).toBeUndefined();
    expect(await Deliverer.countDocuments()).toBe(1);
  });

  test("a legacy admin with a verified email is linked, and their company becomes the first org's tenant", async () => {
    const { company, user } = await legacyAdmin();
    const r = await resolveLocalIdentity({
      clerkUserId: "user_owner",
      email: "owner@test.com",
      emailVerified: true,
      orgId: "org_allea",
      orgName: "Allea Clerk Org",
      orgRole: "org:admin",
    });
    expect(r.linkedLegacy).toBe(true);
    expect(String(r.user._id)).toBe(String(user._id));
    expect(String(r.company._id)).toBe(String(company._id));
    expect(r.company.clerkOrgId).toBe("org_allea");
    expect(await User.countDocuments()).toBe(1);
    expect(await Deliverer.countDocuments()).toBe(1);
  });

  test("an UNVERIFIED email never links a legacy account", async () => {
    const { user } = await legacyAdmin();
    const r = await resolveLocalIdentity({
      clerkUserId: "user_attacker",
      email: "owner@test.com",
      emailVerified: false,
      orgId: "org_attacker",
      orgName: "Evil",
      orgRole: "org:admin",
    });
    expect(r.linkedLegacy).toBe(false);
    expect(String(r.user._id)).not.toBe(String(user._id));
    const legacy = await User.findById(user._id);
    expect(legacy.clerkUserId).toBeUndefined();
  });

  test("an org member (not admin) can't adopt the legacy company and gets the manager role", async () => {
    const { company } = await legacyAdmin();
    const r = await resolveLocalIdentity({
      clerkUserId: "user_member",
      email: "member@test.com",
      emailVerified: true,
      orgId: "org_other",
      orgName: "Other",
      orgRole: "org:member",
    });
    expect(String(r.company._id)).not.toBe(String(company._id));
    expect(r.user.role).toBe("Deliverer Manager");
  });

  test("no active organization means needsOrganization", async () => {
    const r = await resolveLocalIdentity({
      clerkUserId: "user_noorg",
      email: "noorg@test.com",
      emailVerified: true,
    });
    expect(r.needsOrganization).toBe(true);
    expect(r.company).toBeNull();
  });

  test("platform admins keep their role", async () => {
    await User.create({
      name: "Root",
      email: "root@test.com",
      password: "password123",
      phoneNumber: "1",
      role: "Super Admin",
      address: "a",
      city: "c",
    });
    const r = await resolveLocalIdentity({
      clerkUserId: "user_root",
      email: "root@test.com",
      emailVerified: true,
      orgId: "org_root",
      orgName: "Root Org",
      orgRole: "org:member",
    });
    expect(r.user.role).toBe("Super Admin");
  });

  test("a Clerk token for an unlinked user is told to bootstrap; once linked it works", async () => {
    mockAuth.current = { userId: "user_x", orgId: "org_x", orgRole: "org:admin" };
    const first = await request(app)
      .get("/api/v2/user/get-user")
      .set("Authorization", "Bearer faketoken");
    expect(first.status).toBe(401);
    expect(first.body.code).toBe("NEEDS_BOOTSTRAP");

    await resolveLocalIdentity({
      clerkUserId: "user_x",
      email: "x@test.com",
      emailVerified: true,
      orgId: "org_x",
      orgName: "X Haulage",
      orgRole: "org:admin",
    });
    const second = await request(app)
      .get("/api/v2/user/get-user")
      .set("Authorization", "Bearer faketoken");
    expect(second.status).toBe(200);
    expect(second.body.delivererName).toBe("X Haulage");
    expect(second.body.user.password).toBeUndefined();
  });

  test("switching to an organization the user isn't linked to asks to bootstrap again", async () => {
    await resolveLocalIdentity({
      clerkUserId: "user_y",
      email: "y@test.com",
      emailVerified: true,
      orgId: "org_y1",
      orgName: "Y1",
      orgRole: "org:admin",
    });
    mockAuth.current = { userId: "user_y", orgId: "org_y2", orgRole: "org:admin" };
    const res = await request(app)
      .get("/api/v2/user/get-user")
      .set("Authorization", "Bearer faketoken");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("NEEDS_BOOTSTRAP");
  });

  test("an invalid Clerk session is rejected and the legacy cookie path still works", async () => {
    mockAuth.current = null;
    const bad = await request(app)
      .get("/api/v2/user/get-user")
      .set("Authorization", "Bearer faketoken");
    expect(bad.status).toBe(401);

    const { user } = await legacyAdmin();
    const jwt = require("jsonwebtoken");
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY);
    const ok = await request(app)
      .get("/api/v2/user/get-user")
      .set("Cookie", ["token=" + token]);
    expect(ok.status).toBe(200);
  });
});
