// Reads a ZIP (the company export) using fflate from backend/node_modules, so e2e needs no extra dependency.
const path = require("path");
const Module = require("module");
const breq = Module.createRequire(path.resolve(__dirname, "..", "..", "backend", "package.json"));
const { unzipSync, strFromU8 } = breq("fflate");

function unzipFiles(buffer) {
  if (buffer.slice(0, 2).toString() !== "PK") throw new Error("not a zip file");
  return unzipSync(new Uint8Array(buffer));
}

// All text-like entries joined, for "does this contain / not contain X" checks.
function unzipText(buffer) {
  const files = unzipFiles(buffer);
  return Object.entries(files)
    .map(([name, bytes]) => `# ${name}\n${/\.(json|csv|txt|md|html)$/i.test(name) ? strFromU8(bytes) : ""}`)
    .join("\n");
}

module.exports = { unzipFiles, unzipText };
