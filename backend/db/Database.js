const mongoose = require("mongoose");

const db_url =
  process.env.NODE_ENV === "production"
    ? process.env.DB_URL
    : process.env.OFFLINE_DB_URL;
const onlinedb_url = process.env.DB_URL;

// console.log(db_url)

const connectDatabase = () => {
  mongoose
    .connect(
    db_url, {
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
