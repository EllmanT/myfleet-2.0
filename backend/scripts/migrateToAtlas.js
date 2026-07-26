/* eslint-disable no-console */
const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");
const { logger, timedStep } = require("./seed/logger");

dotenv.config({ path: path.resolve(__dirname, "..", "config", ".env") });

const BATCH_SIZE = 500;

function getUris() {
  const sourceUri = process.env.MONGO_URI_LOCAL || process.env.OFFLINE_DB_URL;
  const destUri = process.env.MONGO_URI_LIVE || process.env.DB_URL;

  if (!sourceUri) {
    throw new Error("Missing source Mongo URI. Set MONGO_URI_LOCAL (or OFFLINE_DB_URL).");
  }
  if (!destUri) {
    throw new Error("Missing destination Mongo URI. Set MONGO_URI_LIVE (or DB_URL).");
  }
  if (sourceUri === destUri) {
    throw new Error("Source and destination Mongo URIs are identical — refusing to run.");
  }

  return { sourceUri, destUri };
}

function parseDbName(uri) {
  const parsed = new URL(uri);
  const pathname = parsed.pathname.replace(/^\/+/, "");
  return pathname.split("?")[0] || "myfleet";
}

async function copyCollection(sourceDb, destDb, collectionName) {
  return timedStep(
    `copy:${collectionName}`,
    async () => {
      const existing = await destDb.listCollections({ name: collectionName }).toArray();
      if (existing.length) {
        await destDb.dropCollection(collectionName);
      }

      const cursor = sourceDb.collection(collectionName).find({});
      let batch = [];
      let copied = 0;

      while (await cursor.hasNext()) {
        batch.push(await cursor.next());
        if (batch.length >= BATCH_SIZE) {
          await destDb.collection(collectionName).insertMany(batch, { ordered: false });
          copied += batch.length;
          batch = [];
        }
      }
      if (batch.length) {
        await destDb.collection(collectionName).insertMany(batch, { ordered: false });
        copied += batch.length;
      }

      if (copied === 0) {
        await destDb.createCollection(collectionName);
      }

      logger.info("Collection copied", { collection: collectionName, copied });
      return { collection: collectionName, copied };
    },
    { collection: collectionName }
  );
}

async function main() {
  const { sourceUri, destUri } = getUris();
  const sourceDbName = parseDbName(sourceUri);
  const destDbName = parseDbName(destUri);

  const sourceClient = new MongoClient(sourceUri);
  const destClient = new MongoClient(destUri);

  logger.info("Connecting", { sourceDbName, destDbName });
  await sourceClient.connect();
  await destClient.connect();

  try {
    const sourceDb = sourceClient.db(sourceDbName);
    const destDb = destClient.db(destDbName);

    const collections = await sourceDb.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name).sort();

    if (!collectionNames.length) {
      throw new Error(`No collections found in source database "${sourceDbName}".`);
    }

    logger.info("Migration started", { collections: collectionNames });

    const results = [];
    for (const name of collectionNames) {
      results.push(await copyCollection(sourceDb, destDb, name));
    }

    logger.info("Migration finished", {
      totalCollections: results.length,
      totalDocs: results.reduce((sum, r) => sum + r.copied, 0),
    });
  } finally {
    await sourceClient.close();
    await destClient.close();
    logger.info("Disconnected");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("Migration failed", { errorName: error.name, errorMessage: error.message });
    process.exit(1);
  });
