// Runs before every test file. Tests must never reach real services, even when backend/config/.env
// holds real settings (the app loads that file). Empty values stop dotenv from filling them in.
process.env.BLOB_READ_WRITE_TOKEN = "";
process.env.BLOB_STORE_ID = "";
process.env.CRON_SECRET = "";
