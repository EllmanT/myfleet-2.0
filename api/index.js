const connectDatabase = require("../backend/db/Database");

connectDatabase();

module.exports = require("../backend/app");
