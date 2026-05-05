const path = require("path");
const { ValidationError } = require("./errors");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
// Repo ships JSON under ./db-backup-2026-04-18 (not DB/backup/...).
const DEFAULT_BACKUP_DIR = path.resolve(PROJECT_ROOT, "..", "db-backup-2026-04-18");

const REQUIRED_COLLECTIONS = [
  "users",
  "deliverers",
  "customers",
  "contractors",
  "drivers",
  "vehicles",
  "rates",
  "vehicleexpenses",
  "employeeexpenses",
  "jobs",
];

const DERIVED_COLLECTIONS = [
  "overallstats",
  "vehiclestats",
  "driverstats",
  "contractorstats",
];

function getSeedConfig() {
  const localUri = process.env.MONGO_URI_LOCAL || process.env.OFFLINE_DB_URL;
  const liveUri = process.env.MONGO_URI_LIVE || process.env.DB_URL;
  const backupDir = process.env.SEED_BACKUP_DIR || DEFAULT_BACKUP_DIR;

  if (!localUri) {
    throw new ValidationError(
      "Missing local Mongo URI. Set MONGO_URI_LOCAL (or OFFLINE_DB_URL)."
    );
  }
  if (!liveUri) {
    throw new ValidationError(
      "Missing live Mongo URI. Set MONGO_URI_LIVE (or DB_URL)."
    );
  }

  return {
    localUri,
    liveUri,
    backupDir,
    requiredCollections: REQUIRED_COLLECTIONS,
    derivedCollections: DERIVED_COLLECTIONS,
  };
}

module.exports = {
  getSeedConfig,
  REQUIRED_COLLECTIONS,
  DERIVED_COLLECTIONS,
};
