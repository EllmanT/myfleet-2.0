const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { getUploadsDir } = require("./uploadsDir");

// Only documents and photos. The extension comes from the verified MIME type,
// never from the uploaded file's name.
const ALLOWED = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = getUploadsDir();
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      return cb(e);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Keep only safe characters from the original name so it can't carry a
    // path or odd characters into the filesystem.
    const base = path
      .basename(file.originalname || "file")
      .split(".")[0]
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 40);
    cb(null, `${base || "file"}-${uniqueSuffix}${ALLOWED[file.mimetype]}`);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED[file.mimetype]) return cb(null, true);
  const err = new Error("Only JPG, PNG, WebP or PDF files are allowed");
  err.statusCode = 400;
  cb(err);
}

exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 5 },
});
exports.MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES;
