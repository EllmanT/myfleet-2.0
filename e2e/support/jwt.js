// Minimal HS256 JWT signer, so specs can forge expired / tampered cookies without a dependency.
const crypto = require("crypto");
const { JWT_SECRET } = require("./env");

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function sign(payload, { secret = JWT_SECRET, expiresInSec = 3600 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now - (expiresInSec < 0 ? 7200 : 0), exp: now + expiresInSec, ...payload };
  const head = b64({ alg: "HS256", typ: "JWT" });
  const data = `${head}.${b64(body)}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

module.exports = { sign };
