const { defineConfig, devices } = require("@playwright/test");
const { BASE_URL, PORT } = require("./support/env");

const CI = Boolean(process.env.CI);

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : CI ? 2 : 2,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The app sets a Secure cookie; Chromium accepts that on http://localhost.
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // One throwaway stack for the whole run: builds the web bundle once, then starts the API with
  // an in-memory MongoDB. Never reuses a server that was not started by this config in CI.
  webServer: {
    command: "node scripts/build-web.js && node stack/start.js",
    url: `${BASE_URL}/test`,
    timeout: 600_000,
    reuseExistingServer: !CI,
    stdout: process.env.E2E_VERBOSE ? "pipe" : "ignore",

    stderr: "pipe",
    env: { E2E_PORT: String(PORT) },
  },
});
