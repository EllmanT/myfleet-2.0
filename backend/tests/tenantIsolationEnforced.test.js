// Runs the whole cross-tenant matrix again with the query guard switched to
// "enforce", the setting production should use once existing records are stamped.
// It proves two things: a forgotten filter cannot leak, and a company's own pages
// still show its own data.
process.env.TENANT_GUARD = "enforce";
require("./tenantIsolation.test.js");
