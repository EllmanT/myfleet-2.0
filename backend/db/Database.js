const mongoose = require("mongoose");

const getDbUrl = () =>
  process.env.NODE_ENV === "production"
    ? process.env.DB_URL
    : process.env.OFFLINE_DB_URL;

const connectDatabase = () => {
  if ([1, 2].includes(mongoose.connection.readyState)) {
    return;
  }

  const db_url = getDbUrl();
  if (!db_url || !String(db_url).trim()) {
    console.error("Database URL missing (set OFFLINE_DB_URL or DB_URL).");
    return;
  }

  mongoose.set("strictQuery", true);

  mongoose
    .connect(db_url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then((data) => {
      console.log(`Mongodb running on : ${data.connection.host}`);
    })
    .catch((err) => {
      console.error("Database connection failed:------- ", err);
    });
};

module.exports = connectDatabase;
