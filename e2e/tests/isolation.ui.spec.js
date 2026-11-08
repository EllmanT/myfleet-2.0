/*
 * Multi-tenancy isolation, browser level. Tenant B signs in through the real app and visits
 * every page that lists company data, then tries pages addressed by A's ids. B must see its own
 * data (positive control) and never a trace of A's.
 */
const { test, expect } = require("../support/fixtures");

async function visit(page, url, waitFor) {
  await page.goto(url);
  await expect(page.getByText(waitFor).first()).toBeVisible({ timeout: 20_000 });
}
const html = (page) => page.content();

test.describe("tenant isolation (UI)", () => {
  test("@smoke @full B sees only B's vehicles, customers and drivers, A sees only A's", async ({ world, signedIn }) => {
    const { A, B, dataA, dataB } = world;
    const pageB = await signedIn(B);
    const pageA = await signedIn(A);

    const checks = [
      ["/del-vehicles", (d) => `${d.marker}V1`],
      ["/del-customers", (d) => `${d.marker} Customer One`],
      ["/del-drivers", (d) => `${d.marker} Driver`],
      ["/del-contractors", (d) => `${d.marker} Contractor`],
    ];
    for (const [url, text] of checks) {
      await visit(pageB, url, text(dataB));
      expect(await html(pageB), `B at ${url} shows A's data`).not.toContain(dataA.marker);
      await visit(pageA, url, text(dataA));
      expect(await html(pageA), `A at ${url} shows B's data`).not.toContain(dataB.marker);
    }
  });

  test("@full B's jobs list and dashboard carry no trace of A", async ({ world, signedIn }) => {
    const { dataA, dataB, B } = world;
    const page = await signedIn(B);
    await visit(page, "/del-all-orders", dataB.marker);
    expect(await html(page)).not.toContain(dataA.marker);
    await page.goto("/del-dashboard");
    await expect(page.getByText(B.name).first()).toBeVisible({ timeout: 20_000 });
    expect(await html(page)).not.toContain(dataA.marker);
  });

  test("@full B's invoices page shows B's invoices and none of A's", async ({ world, signedIn }) => {
    const { dataA, dataB } = world;
    const page = await signedIn(world.B);
    await visit(page, "/del-invoices", dataB.marker);
    expect(await html(page)).not.toContain(dataA.marker);
  });

  test("@smoke @full pages addressed by A's ids show nothing of A to B", async ({ world, signedIn }) => {
    const { A, B, dataA } = world;
    const page = await signedIn(B);
    const urls = [
      `/del-dash-vehicle/${dataA.vehicle._id}`,
      `/del-dash-driver/${dataA.driver._id}`,
      `/del-dash-contractor/${dataA.contractor._id}`,
      `/vehicle-analytics/${dataA.vehicle._id}`,
      `/job-analytics/${A.companyId}`,
      `/reports-vehicle/${dataA.vehicle._id}`,
    ];
    for (const url of urls) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const body = await html(page);
      expect(body, `B at ${url}`).not.toContain(dataA.marker);
      expect(body, `B at ${url}`).not.toContain(A.name);
    }
  });

  test("@full an expired or foreign session cannot open a company page (redirected to login)", async ({ browser, world }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/del-vehicles");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await context.close();
    void world;
  });
});
