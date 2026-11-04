const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "test-secret";
process.env.NODE_ENV = "test";

const Deliverer = require("../model/deliverer");
const User = require("../model/user");
const { noticesDue, sendDueNotices } = require("../services/billingEmails");

jest.setTimeout(120000);
const DAY = 86400000;
const days = (n) => new Date(Date.now() + n * DAY);

describe("noticesDue (pure)", () => {
  test("nothing for legacy, suspended, or a trial with time left", () => {
    expect(noticesDue(undefined)).toEqual([]);
    expect(noticesDue({ band: "starter", status: "suspended", trialEndsAt: days(-3) })).toEqual([]);
    expect(noticesDue({ band: "starter", status: "trial", trialEndsAt: days(20) })).toEqual([]);
  });
  test("trial ending within 7 days, then ended", () => {
    expect(noticesDue({ band: "starter", status: "trial", trialEndsAt: days(3) })[0]).toMatchObject({ kind: "trial_ending", daysLeft: 3 });
    expect(noticesDue({ band: "starter", status: "trial", trialEndsAt: days(-1) })[0].kind).toBe("trial_ended");
  });
  test("payment due within 3 days, then overdue once the grace has passed", () => {
    expect(noticesDue({ band: "fleet", status: "active", paidUntil: days(2) })[0].kind).toBe("payment_due");
    expect(noticesDue({ band: "fleet", status: "active", paidUntil: days(20) })).toEqual([]);
    expect(noticesDue({ band: "fleet", status: "active", paidUntil: days(-10) })[0].kind).toBe("payment_overdue");
  });
});

describe("sendDueNotices", () => {
  let mongod;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }, 60000);
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(() => mongoose.connection.db.dropDatabase());

  const make = async (name, billing) => {
    const c = await Deliverer.create({ companyName: name, address: "S", city: "H", goodsType: ["g"], vehiclesType: ["small"], deliveryType: ["standard"], ...(billing ? { billing } : {}) });
    await User.create({ name: "O", email: `${name}@x.test`, password: "password123", phoneNumber: "5", role: "Deliverer Admin", address: "S", city: "H", companyId: c._id });
    return c;
  };

  test("emails the owner once per clock date, again after the trial is extended, never legacy", async () => {
    const sent = [];
    const mailer = async (m) => sent.push(m);
    const a = await make("Ending", { band: "starter", status: "trial", trialEndsAt: days(2) });
    await make("Legacy");
    await make("Fine", { band: "fleet", status: "trial", trialEndsAt: days(40) });

    await sendDueNotices(new Date(), mailer);
    expect(sent).toHaveLength(1);
    expect(sent[0].email).toBe("Ending@x.test");
    expect(sent[0].subject).toMatch(/trial ends in 2 days/);

    await sendDueNotices(new Date(), mailer); // a re-run does not double-send
    expect(sent).toHaveLength(1);

    // trial ends: the "ended" notice goes out once
    await sendDueNotices(new Date(Date.now() + 3 * DAY), mailer);
    expect(sent).toHaveLength(2);
    expect(sent[1].subject).toMatch(/has ended/);

    // extended trial near its end: reminders are possible again
    await Deliverer.updateOne({ _id: a._id }, { "billing.trialEndsAt": days(5) });
    await sendDueNotices(new Date(), mailer);
    expect(sent).toHaveLength(3);
  });

  test("a failed send is not recorded, so tomorrow retries", async () => {
    const c = await make("Flaky", { band: "starter", status: "trial", trialEndsAt: days(1) });
    const res = await sendDueNotices(new Date(), async () => {
      throw new Error("smtp down");
    });
    expect(res[0].error).toBe("smtp down");
    expect((await Deliverer.findById(c._id).lean()).billing.notices).toBeUndefined();
  });
});
