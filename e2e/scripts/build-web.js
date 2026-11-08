/*
 * Builds the React app for the e2e run into e2e/.web-build, WITHOUT Clerk (so the app uses the
 * email/password cookie login) and without touching frontend/build.
 * Skips the build when a build already exists; set E2E_REBUILD=1 to force one.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const FRONTEND = path.join(ROOT, "frontend");
const OUT = path.join(ROOT, "e2e", ".web-build");

if (fs.existsSync(path.join(OUT, "index.html")) && !process.env.E2E_REBUILD) {
  console.log("[e2e] web build present, skipping (E2E_REBUILD=1 to rebuild)");
  process.exit(0);
}
if (!fs.existsSync(path.join(FRONTEND, "node_modules"))) {
  console.error("[e2e] frontend/node_modules missing: run `npm ci` in frontend/ first");
  process.exit(1);
}
const env = {
  ...process.env,
  BUILD_PATH: OUT,
  CI: "false",
  GENERATE_SOURCEMAP: "false",
  // A real Clerk key in frontend/.env.local must not leak into this build. Empty = cookie login.
  REACT_APP_CLERK_PUBLISHABLE_KEY: "",
  REACT_APP_API_ORIGIN: "",
};
const r = spawnSync("npx", ["react-scripts", "build"], { cwd: FRONTEND, env, stdio: "inherit", shell: true });
if (r.status !== 0) process.exit(r.status || 1);

// Hard check: the bundle must not contain a Clerk publishable key.
const bad = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.js$/.test(f.name) && /pk_(test|live)_[A-Za-z0-9]{10,}/.test(fs.readFileSync(p, "utf8"))) bad.push(p);
  }
};
walk(OUT);
if (bad.length) {
  console.error("[e2e] build contains a Clerk publishable key; refusing:", bad);
  fs.rmSync(OUT, { recursive: true, force: true });
  process.exit(1);
}
console.log("[e2e] web build ready (cookie login, no Clerk key)");
