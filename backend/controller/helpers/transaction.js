const mongoose = require("mongoose");

// Runs `work(session)` in a transaction when the server supports it
// (replica set / Atlas), otherwise runs it once without a session
// (standalone local mongod).
async function runWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await work(session);
    });
  } catch (error) {
    const message = String(error?.message || "");
    const notSupported =
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set") ||
      message.includes("Transaction support");

    if (!notSupported) {
      throw error;
    }
    await work(null);
  } finally {
    await session.endSession();
  }
}

module.exports = { runWithOptionalTransaction };
