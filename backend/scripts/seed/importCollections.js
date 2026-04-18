const fs = require("fs/promises");
const path = require("path");
const { EJSON } = require("bson");
const { ImportError, ValidationError } = require("./errors");
const { logger, timedStep } = require("./logger");

const parseCollectionFromFile = (filename) => {
  if (!filename.endsWith(".json")) return null;
  const stem = filename.slice(0, -5);
  const parts = stem.split(".");
  if (parts.length === 1) return parts[0].toLowerCase();
  return parts[parts.length - 1].toLowerCase();
};

const parseJsonPayload = (raw, filename) => {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    const parsed = EJSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new ValidationError("JSON root must be array", { filename });
    }
    return parsed;
  }

  const docs = [];
  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.trim()) continue;
    docs.push(EJSON.parse(line));
  }
  return docs;
};

const loadBackupFiles = async (backupDir) => {
  let entries;
  try {
    entries = await fs.readdir(backupDir, { withFileTypes: true });
  } catch (error) {
    throw new ValidationError("Backup directory not readable", {
      backupDir,
      cause: error.message,
    });
  }

  const fileMap = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const collection = parseCollectionFromFile(entry.name);
    if (!collection) continue;
    fileMap.set(collection, path.join(backupDir, entry.name));
  }
  return fileMap;
};

const importCollection = async (db, collectionName, docs) => {
  return timedStep(
    `import:${collectionName}`,
    async () => {
      const existing = await db.listCollections({ name: collectionName }).toArray();
      if (existing.length) {
        await db.dropCollection(collectionName);
      }

      if (docs.length) {
        await db.collection(collectionName).insertMany(docs, { ordered: false });
      } else {
        await db.createCollection(collectionName);
      }

      const count = await db.collection(collectionName).countDocuments();
      logger.info("Collection imported", {
        collection: collectionName,
        inserted: docs.length,
        count,
      });

      return { collectionName, inserted: docs.length, count };
    },
    { collection: collectionName }
  );
};

async function importCollections({
  db,
  backupDir,
  importOrder,
  requiredCollections = [],
}) {
  const files = await loadBackupFiles(backupDir);

  for (const required of requiredCollections) {
    if (!files.has(required)) {
      throw new ValidationError("Required backup file is missing", {
        collection: required,
        backupDir,
      });
    }
  }

  const results = [];
  for (const collectionName of importOrder) {
    const sourceFile = files.get(collectionName);
    if (!sourceFile) {
      throw new ImportError("Backup file missing for import collection", {
        collection: collectionName,
      });
    }

    const raw = await fs.readFile(sourceFile, "utf8");
    const docs = parseJsonPayload(raw, sourceFile);
    const outcome = await importCollection(db, collectionName, docs);
    results.push({ ...outcome, sourceFile });
  }
  return results;
}

module.exports = {
  importCollections,
  parseCollectionFromFile,
};
