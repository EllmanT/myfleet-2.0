const multer = require("multer");
const { MAX_FILE_BYTES } = require("./services/fileStorage");

// Uploads are held in memory, never written to disk by the web server: serverless disks are
// ephemeral, and a file that is kept is saved through services/fileStorage.js (private
// storage, type decided by the file's bytes). The MIME check here is only a first, cheap gate.
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  const err = new Error("Only JPG, PNG, WebP or PDF files are allowed");
  err.statusCode = 400;
  cb(err);
}

exports.upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: 5 },
});
exports.MAX_UPLOAD_BYTES = MAX_FILE_BYTES;
