const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireModule } = require("../middleware/moduleAccess");
const { requireCompany } = require("../middleware/tenantAccess");
const { extractLocalLog, MAX_FILE_BYTES } = require("../services/aiImport/localLog");
const { rowsToWorkbookBuffer } = require("../services/aiImport/workbook");
const AiUsage = require("../model/aiUsage");
const router = express.Router();

const guard = [isAuthenticated, requireCompany, requireModule("aiImport")];

// Pages of AI reading a company may use each month. Set AI_IMPORT_PAGES_PER_MONTH
// to change it; this is the real-money limit, so keep it modest while pricing is set.
const monthlyLimit = () => Math.max(0, parseInt(process.env.AI_IMPORT_PAGES_PER_MONTH, 10) || 100);
const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

// Each call costs money, so a company can only start so many per window. Counted
// per company (not per address), and off in tests.
const callLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  keyGenerator: (req) => String(req.user && req.user.companyId),
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res) => res.status(429).json({ success: false, message: "Too many photos at once. Wait a few minutes and try again." }),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

const handle = (fn) =>
  catchAsyncErrors(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message || "AI import failed", error.status || 500));
    }
  });

async function usageFor(tenantId) {
  const doc = await AiUsage.findOne({ tenantId, month: monthKey() }).lean();
  const limit = monthlyLimit();
  const used = doc ? doc.pages : 0;
  return { month: monthKey(), used, limit, remaining: Math.max(0, limit - used) };
}

router.get(
  "/usage",
  ...guard,
  handle(async (req, res) => {
    res.status(200).json({ success: true, ...(await usageFor(req.user.companyId)) });
  })
);

// Photo or PDF in, reviewable rows out. Nothing is saved to jobs here.
router.post(
  "/extract",
  ...guard,
  callLimiter,
  upload.single("file"),
  handle(async (req, res, next) => {
    if (!req.file) return next(new ErrorHandler("Choose a photo or PDF of the logbook page", 400));

    const before = await usageFor(req.user.companyId);
    if (before.remaining < 1) {
      return next(new ErrorHandler(`You've used this month's ${before.limit} pages of AI reading. You can still import Excel files, or contact us for more.`, 429));
    }

    const result = await extractLocalLog({
      buffer: req.file.buffer,
      hints: { vehicleReg: req.body.vehicleReg, year: req.body.year, month: req.body.month },
    });

    // count what was actually used, from the API's own figures
    await AiUsage.updateOne(
      { tenantId: req.user.companyId, month: monthKey() },
      {
        $inc: {
          pages: result.pages,
          calls: 1,
          inputTokens: Number(result.usage.input_tokens) || 0,
          outputTokens: Number(result.usage.output_tokens) || 0,
        },
      },
      { upsert: true }
    );

    const { usage, ...clean } = result;
    res.status(200).json({ success: true, ...clean, allowance: await usageFor(req.user.companyId) });
  })
);

// Reviewed rows -> a standard vehicle-log workbook, which then goes through the
// normal Excel preview and import.
router.post(
  "/workbook",
  ...guard,
  handle(async (req, res) => {
    const buffer = rowsToWorkbookBuffer({
      vehicleReg: req.body.vehicleReg,
      vehicleDescription: req.body.vehicleDescription,
      rows: req.body.rows,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="photo-log.xlsx"');
    res.status(200).send(buffer);
  })
);

module.exports = router;
