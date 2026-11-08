// Client for the localhost-only control API served by e2e/stack/start.js.
const { CTL_URL, CTL_TOKEN } = require("./env");

async function ctl(path, body) {
  const res = await fetch(`${CTL_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-e2e-token": CTL_TOKEN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`control ${path} -> ${res.status}: ${json.error || JSON.stringify(json)}`);
  return json;
}

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY).toISOString();

module.exports = { ctl, DAY, daysFromNow };
