const path = require("path");

/**
 * Writable upload directory. On Vercel only `/tmp` is writable; files there are ephemeral.
 */
function getUploadsDir() {
  // lets tests (and unusual hosts) choose where files go
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  if (process.env.VERCEL) {
    return path.join("/tmp", "myfleet-uploads");
  }
  return path.join(__dirname, "uploads");
}

module.exports = { getUploadsDir };
