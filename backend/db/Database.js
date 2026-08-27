const mongoose = require("mongoose");

const getDbUrl = () =>
  process.env.NODE_ENV === "production"
    ? process.env.DB_URL
    : process.env.OFFLINE_DB_URL;

mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

async function connectDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const db_url = getDbUrl();
    if (!db_url || !String(db_url).trim()) {
      throw new Error("Database URL missing (set OFFLINE_DB_URL or DB_URL).");
    }

    cached.promise = mongoose
      .connect(db_url, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
      })
      .then((data) => {
        console.log(`Mongodb running on : ${data.connection.host}`);
        return data;
      })
      .catch((err) => {
        cached.promise = null;
        console.error("Database connection failed:------- ", err);
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDatabase;
