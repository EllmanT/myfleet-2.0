/*
 * Private file storage for documents people upload (driver IDs and licences, and
 * later compliance papers).
 *
 * Where files live:
 *   - Vercel Blob, in a PRIVATE store, when BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID is set
 *     (on Vercel, connect a private store to the project and it uses OIDC automatically).
 *   - a private folder on disk otherwise (local development and tests only; on Vercel the
 *     disk is ephemeral, so production must have the Blob store connected).
 *
 * Rules that hold for both:
 *   - the key is generated here: tenants/<companyId>/<kind>/<random uuid>.<ext>. Nothing from
 *     the uploaded file's name is ever used, so a name cannot carry a path.
 *   - the type is decided by the file's first bytes, not by what the browser claims
 *   - nothing is public: files are only ever returned by an authenticated route that checks
 *     the key belongs to the caller's company (controller/files.js)
 */
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const ErrorHandler = require("../utils/ErrorHandler");
const { getUploadsDir } = require("../uploadsDir");

const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel rejects request bodies over about 4.5 MB

const KEY_PATTERN = /^tenants\/([a-f0-9]{24})\/([a-z][a-z-]{0,30})\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;

// What the first bytes say the file is. Returns null for anything we do not accept.
function sniffType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: "png" };
  }
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

const MIME_BY_EXT = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

// "tenants/<id>/<kind>/<uuid>.<ext>" -> { tenantId, kind, ext }, or null if it is not one of ours
function parseKey(key) {
  const m = KEY_PATTERN.exec(String(key || ""));
  return m ? { tenantId: m[1], kind: m[2], ext: m[3] } : null;
}
const isStoredKey = (value) => Boolean(parseKey(value));

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// ---- Vercel Blob (private store) ------------------------------------------------------------
const blobDriver = {
  async put(key, buffer, contentType) {
    const { put } = require("@vercel/blob");
    await put(key, buffer, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false });
  },
  async get(key) {
    const { get } = require("@vercel/blob");
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { stream: Readable.fromWeb(result.stream), contentType: result.blob && result.blob.contentType };
  },
  async del(key) {
    const { del } = require("@vercel/blob");
    await del(key);
  },
};

// ---- local disk (development and tests) -----------------------------------------------------
const diskPath = (key) => path.join(getUploadsDir(), "private", ...key.split("/"));
const diskDriver = {
  async put(key, buffer) {
    const file = diskPath(key);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, buffer, { flag: "wx" });
  },
  async get(key) {
    const file = diskPath(key);
    try {
      await fsp.access(file);
    } catch (error) {
      return null;
    }
    return { stream: fs.createReadStream(file), contentType: MIME_BY_EXT[parseKey(key).ext] };
  },
  async del(key) {
    await fsp.rm(diskPath(key), { force: true });
  },
};

const driver = () => (useBlob() ? blobDriver : diskDriver);

// Store an uploaded file for a company. `buffer` is the file's bytes (multer memory storage).
async function saveFile({ tenantId, kind, buffer }) {
  if (!/^[a-f0-9]{24}$/.test(String(tenantId))) throw new ErrorHandler("Your account has no company", 403);
  if (!/^[a-z][a-z-]{0,30}$/.test(kind)) throw new Error("Invalid file kind");
  if (!buffer || !buffer.length) throw new ErrorHandler("The file is empty", 400);
  if (buffer.length > MAX_FILE_BYTES) {
    throw new ErrorHandler("That file is too large. Use one under 4 MB (a phone photo is shrunk automatically).", 413);
  }
  const type = sniffType(buffer);
  if (!type) throw new ErrorHandler("Only JPG, PNG, WebP or PDF files are allowed", 400);

  const key = `tenants/${tenantId}/${kind}/${crypto.randomUUID()}.${type.ext}`;
  await driver().put(key, buffer, type.mime);
  return { key, contentType: type.mime };
}

// -> { stream, contentType } or null when there is no such file
async function readFile(key) {
  if (!isStoredKey(key)) return null;
  return driver().get(key);
}

// Best effort and idempotent: deleting something already gone, or a legacy value that is not
// one of our keys, is not an error.
async function deleteFile(key) {
  if (!isStoredKey(key)) return false;
  try {
    await driver().del(key);
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[file-storage] could not delete", key, error.message);
    return false;
  }
}

module.exports = { saveFile, readFile, deleteFile, parseKey, isStoredKey, sniffType, MAX_FILE_BYTES };
