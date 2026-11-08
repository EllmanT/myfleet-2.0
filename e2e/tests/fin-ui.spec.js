/*
 * Browser tests for the finance screens: invoices, payments, credit notes, "who owes me",
 * quotations, PDFs, the dashboard tiles and the profitability report. Data is arranged through the
 * API (fixtures in support/fin.js); the browser asserts what a person can read on screen.
 */
const { test, expect } = require("../support/fixtures");
const { createTenant } = require("../support/tenants");
const { daysFromNow } = require("../support/control");
const { buildStatsCo, buildReference, addJobs, issued, draft, day, pdfText } = require("../support/fin");

// react-hot-toast toasts carry aria-live; the billing banner is also role=status but has none.
const toast = (page) => page.locator('[role="status"][aria-live]');
// A statistics tile: the title text sits two levels under the tile box.
const tile = (page, title) =>
  page.locator("h6").filter({ hasText: new RegExp(`^${title.replace(/[*]/g, "\\*")}$`) }).first().locator("xpath=../..");
const row = (page, text) => page.locator("tr", { hasText: text }).first();

async function openInvoicesTab(page, name) {
  await page.goto("/del-invoices");
  await expect(page.getByRole("heading", { name: "INVOICES" })).toBeVisible({ timeout: 20_000 });
  if (name) await page.getByRole("tab", { name }).click();
}

test.describe("invoices in the browser", () => {
  test("@smoke @full create an invoice with tax, issue it, see INV-0001 and the right totals, then pay and credit it", async ({ signedIn }) => {
    const t = await createTenant("UiInv");
    const page = await signedIn(t);
    await openInvoicesTab(page);
    await expect(page.getByText("No invoices yet.")).toBeVisible();

    await page.getByRole("button", { name: "New invoice" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByText("New invoice")).toBeVisible();
    await dlg.getByLabel("Customer").fill("Acme Mining");
    await dlg.getByLabel("Description").fill("Harare to Mutare");
    await dlg.getByLabel("Qty").fill("2");
    await dlg.getByLabel("Price").fill("45.50");
    await dlg.getByRole("button", { name: "+ Add a line" }).click();
    await dlg.getByLabel("Description").nth(1).fill("Border fee");
    await dlg.getByLabel("Price").nth(1).fill("100");
    await dlg.getByLabel("Tax %").fill("15");
    // totals update live (TEST_DATA.md worked example)
    await expect(dlg.getByText("Subtotal $191.00")).toBeVisible();
    await expect(dlg.getByText("Tax (15%) $28.65")).toBeVisible();
    await expect(dlg.getByText("Total $219.65")).toBeVisible();

    await dlg.getByRole("button", { name: "Issue invoice" }).click();
    await expect(toast(page).filter({ hasText: "Invoice issued" })).toBeVisible();
    const r = row(page, "INV-0001");
    await expect(r).toContainText("Acme Mining");
    await expect(r).toContainText("$219.65");
    await expect(r.getByText("Unpaid")).toBeVisible();
    await expect(page.getByText(/Outstanding\s*\$219\.65/)).toBeVisible();

    // record a $100 payment from inside the invoice
    await r.click();
    const view = page.getByRole("dialog").first();
    await expect(view.getByText("INV-0001")).toBeVisible();
    await view.getByRole("button", { name: "Record payment" }).click();
    const pay = page.getByRole("dialog").last();
    await pay.getByLabel("Amount received").fill("100");
    await pay.getByRole("button", { name: "Save payment" }).click();
    await expect(toast(page).filter({ hasText: "Payment recorded" })).toBeVisible();
    await expect(view.getByRole("row", { name: /Balance/ })).toContainText("$119.65");

    // credit note through the prompts the screen uses
    const answers = ["19.65", "goodwill"];
    page.on("dialog", (d) => d.accept(answers.shift() || ""));
    await view.getByRole("button", { name: "Credit note" }).click();
    await expect(toast(page).filter({ hasText: "Credit note added" })).toBeVisible();
    await expect(view.getByRole("row", { name: /Balance/ })).toContainText("$100.00");
    await expect(view.getByRole("row", { name: /Credit notes/ })).toContainText("$19.65");
    // a part-paid invoice cannot be voided: no Void button once money has been received
    await expect(view.getByRole("button", { name: "Void" })).toHaveCount(0);
    await view.getByRole("button", { name: "Close" }).click();
    await expect(row(page, "INV-0001").getByText("Part paid")).toBeVisible();
  });

  test("@full an invoice PDF opens from the screen and is a real PDF for that invoice", async ({ signedIn }) => {
    const t = await createTenant("UiPdf");
    const api = await t.api();
    const inv = await issued(api, { customerName: "Pdf Customer", lines: [{ description: "Haulage to Bulawayo", quantity: 1, unitPrice: 250 }] });
    const page = await signedIn(t);
    await openInvoicesTab(page);
    await row(page, "INV-0001").click();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/invoice/pdf/${inv._id}`)),
      page.context().waitForEvent("page"),
      page.getByRole("dialog").getByRole("button", { name: "PDF" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toMatch(/pdf/);
    const text = pdfText(await resp.body());
    expect(text).toContain(t.name);
    expect(text).toContain("INV-0001");
    expect(text).toContain("$250.00");
  });

  test("@smoke @full 'Who owes me' shows the ageing buckets from the worked example (270.00 owed)", async ({ signedIn }) => {
    const t = await createTenant("UiAgeing");
    const api = await t.api();
    // dates relative to today so the buckets are the same whenever the suite runs
    const mk = (offsetDue, amount) => issued(api, { customerName: "Ageing Customer X", issueDate: day(-200), dueDate: day(offsetDue), lines: [{ description: "x", quantity: 1, unitPrice: amount }] });
    await mk(12, 100); // not yet due
    await mk(-19, 50); // 1-30
    await mk(-49, 80); // 31-60
    await mk(-130, 40); // 90+
    const page = await signedIn(t);
    await openInvoicesTab(page, "Who owes me");
    await expect(page.getByText("$270.00 owed")).toBeVisible();
    const r = row(page, "Ageing Customer X");
    const cells = await r.locator("td").allTextContents();
    expect(cells).toEqual(["Ageing Customer X", "4", "$100.00", "$50.00", "$80.00", "$0.00", "$40.00", "$270.00"]);
    // the invoices list agrees: outstanding 270.00 of which 170.00 is overdue
    await page.getByRole("tab", { name: "Invoices" }).click();
    await expect(page.getByText(/Outstanding\s*\$270\.00\s*\|\s*Overdue\s*\$170\.00/)).toBeVisible();
    // filtering to overdue hides the not-yet-due invoice
    await page.locator(".MuiFormControl-root", { hasText: "Payment" }).getByRole("button").click();
    await page.getByRole("option", { name: "Overdue" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(3);
  });

  test("@full the Payments tab records a lump sum against the oldest invoices and deleting it restores the debt", async ({ signedIn }) => {
    const t = await createTenant("UiPay");
    const api = await t.api();
    await issued(api, { customerName: "Payment Customer Y", issueDate: "2026-01-01", lines: [{ description: "a", quantity: 1, unitPrice: 100 }] });
    await issued(api, { customerName: "Payment Customer Y", issueDate: "2026-02-01", lines: [{ description: "b", quantity: 1, unitPrice: 50 }] });
    const page = await signedIn(t);
    await openInvoicesTab(page, "Payments");
    await page.getByRole("button", { name: "Record a payment" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel(/Customer/).fill("Payment Customer Y");
    await dlg.getByLabel("Amount received").fill("120");
    await dlg.getByRole("button", { name: "Save payment" }).click();
    await expect(toast(page).filter({ hasText: "Payment recorded" })).toBeVisible();
    const r = row(page, "Payment Customer Y");
    await expect(r).toContainText("$120.00");
    await expect(r).toContainText("INV-0001 ($100.00), INV-0002 ($20.00)");

    page.once("dialog", (d) => d.accept());
    await r.getByRole("button", { name: "Delete payment" }).click();
    await expect(toast(page).filter({ hasText: "Payment deleted" })).toBeVisible();
    await page.getByRole("tab", { name: "Who owes me" }).click();
    await expect(page.getByText("$150.00 owed")).toBeVisible();
  });

  test("@full voiding an unpaid invoice from the screen greys it out and removes it from what is owed", async ({ signedIn }) => {
    const t = await createTenant("UiVoid");
    const api = await t.api();
    await issued(api, { customerName: "Void Me", lines: [{ description: "x", quantity: 1, unitPrice: 80 }] });
    const page = await signedIn(t);
    await openInvoicesTab(page);
    await row(page, "INV-0001").click();
    page.once("dialog", (d) => d.accept("billed twice"));
    await page.getByRole("dialog").getByRole("button", { name: "Void" }).click();
    await expect(toast(page).filter({ hasText: "Invoice voided" })).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Voided: billed twice")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(row(page, "INV-0001").getByText("Void", { exact: true })).toBeVisible();
    await expect(page.getByText(/Outstanding\s*\$0\.00/)).toBeVisible();
  });

  test("@smoke @full after the trial ends the screens still read but saving is refused with the trial message", async ({ signedIn }) => {
    const t = await createTenant("UiRo", { billing: { band: "starter", status: "trial", trialEndsAt: daysFromNow(-1) } });
    const page = await signedIn(t);
    await openInvoicesTab(page);
    await page.getByRole("button", { name: "New invoice" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Customer").fill("Too Late");
    await dlg.getByLabel("Description").fill("x");
    await dlg.getByLabel("Price").fill("10");
    await dlg.getByRole("button", { name: "Save draft" }).click();
    await expect(toast(page).filter({ hasText: /free trial has ended/i })).toBeVisible();
    await dlg.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("No invoices yet.")).toBeVisible();
  });

  test("@full a manager (not a company admin) cannot see invoice data on the finance screens", async ({ signedIn }) => {
    const t = await createTenant("UiMgr", { users: [{ role: "Deliverer Admin", key: "admin" }, { role: "Deliverer Manager", key: "manager" }] });
    await issued(await t.api(), { customerName: "Secret Customer", lines: [{ description: "x", quantity: 1, unitPrice: 987.65 }] });
    const page = await signedIn(t, "manager");
    await page.goto("/del-invoices");
    await page.waitForLoadState("networkidle");
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Secret Customer");
    expect(body).not.toContain("987.65");
  });
});

test.describe("quotations in the browser", () => {
  test("@smoke @full create, send, accept and turn a quotation into an invoice draft", async ({ signedIn }) => {
    const t = await createTenant("UiQuo");
    const page = await signedIn(t);
    await page.goto("/del-quotations");
    await expect(page.getByRole("heading", { name: "QUOTATIONS" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("No quotations yet.")).toBeVisible();

    await page.getByRole("button", { name: "New quotation" }).click();
    let dlg = page.getByRole("dialog");
    await dlg.getByLabel("Customer").fill("Quote Customer");
    await dlg.getByLabel(/What is it for/).fill("Harare to Johannesburg, 30t");
    await dlg.getByLabel("Description").fill("Freight");
    await dlg.getByLabel("Qty").fill("2");
    await dlg.getByLabel("Price").fill("450.25");
    await dlg.getByLabel("Tax %").fill("10");
    await expect(dlg.getByText("Total $990.55")).toBeVisible();
    await dlg.getByRole("button", { name: "Save", exact: true }).click();
    await expect(toast(page).filter({ hasText: "Quotation saved" })).toBeVisible();

    const r = row(page, "QUO-0001");
    await expect(r).toContainText("Quote Customer");
    await expect(r).toContainText("$990.55");
    await expect(r.getByText("Draft")).toBeVisible();
    await r.click();
    dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: "Mark as sent" }).click();
    await expect(toast(page).filter({ hasText: "Marked sent" })).toBeVisible();
    await dlg.getByRole("button", { name: "Accepted" }).click();
    await expect(toast(page).filter({ hasText: "Marked accepted" })).toBeVisible();
    await dlg.getByRole("button", { name: "Turn into an invoice" }).click();
    await expect(toast(page).filter({ hasText: /Invoice draft created/ })).toBeVisible();
    await expect(row(page, "QUO-0001").getByText("Accepted - invoiced")).toBeVisible();

    await openInvoicesTab(page);
    const inv = row(page, "Quote Customer");
    await expect(inv).toContainText("(draft)");
    await expect(inv).toContainText("$990.55");
  });

  test("@full a quotation PDF opens from the screen", async ({ signedIn }) => {
    const t = await createTenant("UiQuoPdf");
    const api = await t.api();
    const q = (await api.post("/api/v2/quotation/create-quotation", { customerName: "Pdf Quote", subject: "Special load", lines: [{ description: "Freight", quantity: 1, unitPrice: 75 }] })).body.quotation;
    const page = await signedIn(t);
    await page.goto("/del-quotations");
    await row(page, "QUO-0001").click();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/quotation/pdf/${q._id}`)),
      page.context().waitForEvent("page"),
      page.getByRole("dialog").getByRole("button", { name: "PDF" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    const text = pdfText(await resp.body());
    expect(text).toContain("QUOTATION");
    expect(text).toContain("Special load");
  });
});

test.describe("dashboard and profitability tiles", () => {
  test.describe.configure({ mode: "serial" });
  let co;
  test.beforeAll(async () => {
    co = await buildStatsCo("UiStats");
  });

  test("@smoke @full dashboard 2026 tiles: Total Jobs 7, Tot Revenue 394.00, Customers 5, Contractors 2; 2025 shows 1 job / 6.00", async ({ signedIn }) => {
    const page = await signedIn(co.t);
    await page.goto("/del-dashboard");
    await expect(tile(page, "Total Jobs")).toContainText("7", { timeout: 20_000 });
    await expect(tile(page, "Tot Revenue")).toContainText("394.00");
    await expect(tile(page, "Customers")).toContainText("5");
    await expect(tile(page, "Contractors")).toContainText("2");

    await page.getByLabel("Select year").click();
    await page.getByRole("option", { name: "2025" }).click();
    await expect(tile(page, "Total Jobs")).toContainText("1");
    await expect(tile(page, "Tot Revenue")).toContainText("6.00");
    await page.getByLabel("Select year").click();
    await page.getByRole("option", { name: "2026" }).click();
    await expect(tile(page, "Tot Revenue")).toContainText("394.00");
  });

  test("@smoke @full profitability tiles and tables: revenue 444.00, costs 1,039.00, profit -595.00, cash profit -495.00; Total job revenue 394.00", async ({ signedIn }) => {
    const page = await signedIn(co.t);
    await page.goto("/del-profitability");
    await expect(tile(page, "Revenue")).toContainText("$444.00", { timeout: 20_000 });
    await expect(tile(page, "Revenue")).toContainText("7 legs, 490 km");
    await expect(tile(page, "Costs")).toContainText("$1,039.00");
    await expect(tile(page, "Profit")).toContainText("-595.00");
    await expect(tile(page, "Cash profit*")).toContainText("-495.00");
    await expect(tile(page, "Cash profit*")).toContainText("incl. $100.00 left in business");

    // By month: January shows job revenue 90.00 + other income 50.00 and a -60.00 profit
    const jan = row(page, "Jan");
    await expect(jan).toContainText("$90.00");
    await expect(jan).toContainText("$50.00");
    await expect(jan).toContainText("-60.00");
    await expect(row(page, "Feb")).toContainText("$184.00");
    await expect(row(page, "Mar")).toContainText("-469.00");
    // the Total row's job revenue equals the dashboard's Tot Revenue
    const totalRow = page.locator("tr", { has: page.getByRole("cell", { name: "Total", exact: true }) }).first();
    await expect(totalRow.locator("td").nth(1)).toHaveText("$394.00");
    // By vehicle
    await expect(row(page, "QAA1001")).toContainText("-40.00");
    await expect(row(page, "QAB2002")).toContainText("$14.00");
    await expect(row(page, "Shared costs")).toContainText("-100.00");

    // 2025: only J7
    await page.locator(".MuiFormControl-root", { hasText: "Year" }).getByRole("button").click();
    await page.getByRole("option", { name: "2025" }).click();
    await expect(tile(page, "Revenue")).toContainText("$6.00");
    await expect(tile(page, "Costs")).toContainText("$0.00");
  });

  test("@full the same figure on the two pages: dashboard Tot Revenue equals profitability job revenue (and 'Revenue' there adds other income)", async ({ signedIn }) => {
    const page = await signedIn(co.t);
    await page.goto("/del-dashboard");
    await expect(tile(page, "Tot Revenue")).toContainText("394.00", { timeout: 20_000 });
    const dashRevenue = Number((await tile(page, "Tot Revenue").innerText()).match(/[\d,]+\.\d\d/)[0].replace(/,/g, ""));
    await page.goto("/del-profitability");
    const profRevenue = Number((await tile(page, "Revenue").innerText()).match(/[\d,]+\.\d\d/)[0].replace(/,/g, ""));
    // Not equal by design: 394.00 job revenue + 50.00 cash hire. Both tiles are called "revenue".
    expect(profRevenue - dashRevenue).toBe(50);
  });

  test("@full Sync Stats on the dashboard succeeds for a company admin", async ({ signedIn }) => {
    test.fixme(true, "CONFIRMED FINDING: the button POSTs /overallStats/rebuild-stats with an empty body; the route is platform-admin only and needs companyId, so a company admin gets an error and the screen shows nothing (no snackbar, no toast).");
    const page = await signedIn(co.t);
    await page.goto("/del-dashboard");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/overallStats/rebuild-stats")),
      page.getByRole("button", { name: "Sync Stats" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    await expect(page.getByText("Stats rebuilt successfully!")).toBeVisible();
  });
});

test.describe("tenant isolation of the on-screen figures", () => {
  test("@smoke @full company B's dashboard and profitability show only B's numbers, though names overlap with company A", async ({ signedIn }) => {
    const A = await buildStatsCo("UiIsoA");
    const B = await buildReference("UiIsoB");
    await addJobs(B.api, B.ids, [
      { n: "J1", date: "2026-01-12", ctr: "Lammel QA", veh: "QAA1001", drv: "Tendai", type: "local", legs: [["Depot", "Delta Mining", 5000, 5010, 10, 7.77]] },
    ]);
    const page = await signedIn(B.t);
    await page.goto("/del-dashboard");
    await expect(tile(page, "Total Jobs")).toContainText("1", { timeout: 20_000 });
    await expect(tile(page, "Tot Revenue")).toContainText("7.77");
    await page.goto("/del-profitability");
    await expect(tile(page, "Revenue")).toContainText("$7.77", { timeout: 20_000 });
    await expect(tile(page, "Costs")).toContainText("$0.00");
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/394|444\.00|1,039|595/);

    // A is unaffected
    const pageA = await signedIn(A.t);
    await pageA.goto("/del-dashboard");
    await expect(tile(pageA, "Tot Revenue")).toContainText("394.00", { timeout: 20_000 });
  });
});
