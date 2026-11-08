// Single source for where the e2e stack lives. The stack itself (e2e/stack/start.js) reads the same vars.
const PORT = Number(process.env.E2E_PORT || 5057);

module.exports = {
  PORT,
  BASE_URL: `http://localhost:${PORT}`,
  CTL_URL: `http://127.0.0.1:${PORT + 1}`,
  CTL_TOKEN: process.env.E2E_CONTROL_TOKEN || "e2e-local-control-token",
  PASSWORD: "e2e-password-1",
  // Same values stack/start.js gives the server; the stack is throwaway so these are not secrets.
  JWT_SECRET: "e2e-jwt-secret",
  ACTIVATION_SECRET: "e2e-activation-secret",
};
