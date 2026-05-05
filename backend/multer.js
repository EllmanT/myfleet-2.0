const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { getUploadsDir } = require("./uploadsDir");

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
    const filename = file.originalname.split(".")[0];
    cb(null, filename + "-" + uniqueSuffix + ".png");
  },
});

exports.upload = multer({ storage: storage });
