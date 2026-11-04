const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isGlobalAdmin } = require("../middleware/tenantAccess");
const { readFile, parseKey } = require("../services/fileStorage");

const router = express.Router();

// GET /api/v2/files/tenants/<companyId>/<kind>/<name>.<ext>
// The only way a stored document leaves private storage. The caller must be signed in and the
// file must belong to their own company (platform admins excepted). A foreign or missing file
// both answer 404, so keys cannot be probed.
router.get(
  "/*",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const key = req.params[0];
    const parsed = parseKey(key);
    if (!parsed) return next(new ErrorHandler("Not found", 404));
    if (!isGlobalAdmin(req.user) && parsed.tenantId !== String(req.user.companyId)) {
      return next(new ErrorHandler("Not found", 404));
    }

    const file = await readFile(key);
    if (!file) return next(new ErrorHandler("Not found", 404));

    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Identity documents: the browser may show them but must not keep a copy.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", "inline");
    file.stream.on("error", () => res.destroy());
    file.stream.pipe(res);
  })
);

module.exports = router;
