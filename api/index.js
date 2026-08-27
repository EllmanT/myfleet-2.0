const connectDatabase = require("../backend/db/Database");
const app = require("../backend/app");

module.exports = async (req, res) => {
  try {
    await connectDatabase();
  } catch (err) {
    res.status(503).json({
      success: false,
      message: `Database unavailable: ${err.message}`,
    });
    return;
  }
  return app(req, res);
};
