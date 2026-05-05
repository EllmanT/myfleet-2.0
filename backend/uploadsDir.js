const path = require("path");

/**
 * Writable upload directory. On Vercel only `/tmp` is writable; files there are ephemeral.
 */
function getUploadsDir() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "myfleet-uploads");
  }
  return path.join(__dirname, "uploads");
}

module.exports = { getUploadsDir };
