const express = require("express");
const multer = require("multer");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { buildImportPreview } = require("../services/jobImport/buildImportPreview");
const { commitImport } = require("../services/jobImport/commitImport");

const router = express.Router();

// Logs are small; keep them in memory (serverless has no durable disk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) return cb(null, true);
    return cb(new ErrorHandler(`${file.originalname} is not an Excel file`, 400));
  },
});

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new ErrorHandler("Malformed import request", 400);
  }
}

// Multipart body: files[] + optional `choices` / `options` JSON strings.
function readImportRequest(req) {
  const files = (req.files || []).map((file) => ({
    fileName: file.originalname,
    buffer: file.buffer,
  }));
  if (!files.length) {
    throw new ErrorHandler("Choose at least one Excel file", 400);
  }
  return {
    files,
    companyId: req.user.companyId,
    choices: parseJsonField(req.body.choices, {}),
    options: parseJsonField(req.body.options, {}),
  };
}

function toHttpError(error) {
  if (error instanceof ErrorHandler) return error;
  return new ErrorHandler(error.message || "Import failed", error.statusCode || 400);
}

// Read-only: what would be imported, and what needs the user's review.
router.post(
  "/preview",
  isAuthenticated,
  upload.array("files", 10),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const preview = await buildImportPreview(readImportRequest(req));
      res.status(200).json({ success: true, preview });
    } catch (error) {
      return next(toHttpError(error));
    }
  })
);

// Re-derives the preview with the user's choices and writes it.
router.post(
  "/commit",
  isAuthenticated,
  upload.array("files", 10),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const result = await commitImport(readImportRequest(req));
      res.status(201).json({
        success: true,
        message: `Imported ${result.jobsCreated} jobs (${result.legsCreated} trips)`,
        result,
      });
    } catch (error) {
      return next(toHttpError(error));
    }
  })
);

module.exports = router;
