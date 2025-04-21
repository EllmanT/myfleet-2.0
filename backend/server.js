const app = require("./app");
const connectDatabase = require("./db/Database");

// uncaught exception
process.on("uncaughtException", (err) => {
  console.log(`There was an error or ${err.message}`);
  console.log(`Shutting down the server due to uncaught exception`);
});

//config
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "config/.env",
  });
}

//start mongodb
connectDatabase();

//start server
const server = app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});

//unhandled rejection
process.on("unhandledRejection", (err) => {
  console.log(`There was an error of ${err.message}`);
  console.log(`Shutting down the server due to unhandled rejection`);

  server.close(() => {
    process.exit(1);
  });
});
