// The optional parts of the app a company can switch on or off.
// Core features (jobs, customers, contractors, vehicles, drivers, admins and the
// main dashboard) are always on and are not listed here.
//
// `available: false` modules are on the roadmap: they show as "coming soon" and
// cannot be enabled yet.
const MODULES = [
  {
    key: "expenses",
    label: "Expenses & profitability",
    description: "Record costs and extra income, and see profit per truck.",
    available: true,
    newTenantDefault: false,
  },
  {
    key: "fuel",
    label: "Fuel log",
    description: "Track fill-ups and check fuel use against kilometres driven.",
    available: true,
    newTenantDefault: false,
  },
  {
    key: "analytics",
    label: "Revenue analytics",
    description: "Daily, monthly and breakdown revenue charts.",
    available: true,
    newTenantDefault: true,
  },
  {
    key: "tractorUnits",
    label: "Tractor units (horse + trailer)",
    description: "Trailers as separate assets, plus licence, Yellow Card and permit expiry reminders.",
    available: true,
    newTenantDefault: false,
  },
  {
    key: "crossBorder",
    label: "Cross-border trips",
    description: "Whole-trip records with route, price, border crossings and trip costs.",
    available: true,
    newTenantDefault: false,
  },
  {
    key: "quotations",
    label: "Quotations",
    description: "Send quotations to customers and turn accepted ones into invoices.",
    available: true,
    newTenantDefault: false,
  },
  {
    key: "invoices",
    label: "Invoices & payments",
    description: "Raise invoices, record payments and see what is unpaid.",
    available: true,
    newTenantDefault: false,
  },
  {
    key: "maintenance",
    label: "Maintenance & tyres",
    description: "Service reminders, workshop records, and tyre life and cost per km.",
    available: true,
    newTenantDefault: false,
  },
  {
    key: "aiImport",
    label: "AI logbook import",
    description: "Turn photos of logbooks into jobs, with review before saving.",
    available: true,
    newTenantDefault: false,
  },
];

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

// What a brand-new company starts with: a lean app.
const NEW_TENANT_MODULES = Object.fromEntries(
  MODULES.map((m) => [m.key, m.available && m.newTenantDefault])
);

// Companies that existed before module toggles have no stored settings. They keep
// every available module on so nothing disappears from under them.
function resolveModules(stored) {
  const hasSettings = stored && typeof stored === "object" && Object.keys(stored).length > 0;
  return Object.fromEntries(
    MODULES.map((m) => {
      if (!m.available) return [m.key, false];
      if (!hasSettings) return [m.key, true];
      return [m.key, stored[m.key] === undefined ? m.newTenantDefault : Boolean(stored[m.key])];
    })
  );
}

// Validates a change request. Returns { ok, error, next } where `next` is the full
// settings object to store.
function applyModuleChanges(stored, changes, registry = MODULES) {
  const byKey = registry === MODULES ? BY_KEY : new Map(registry.map((m) => [m.key, m]));
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return { ok: false, error: "Send the modules you want to change" };
  }
  const current = resolveModules(stored);
  for (const [key, value] of Object.entries(changes)) {
    const module = byKey.get(key);
    if (!module) return { ok: false, error: `Unknown module: ${key}` };
    if (typeof value !== "boolean") return { ok: false, error: `${key} must be true or false` };
    if (!module.available && value) {
      return { ok: false, error: `${module.label} is not available yet` };
    }
    current[key] = value;
  }
  return { ok: true, next: current };
}

module.exports = {
  MODULES,
  NEW_TENANT_MODULES,
  resolveModules,
  applyModuleChanges,
};
