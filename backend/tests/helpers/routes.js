// Lists every route the Express app exposes under /api, discovered from the router stack, so a
// route added later is picked up by the sweep tests automatically.
function listRoutes(expressApp) {
  const out = [];
  const walk = (stack, prefix) => {
    for (const layer of stack) {
      if (layer.route) {
        if (typeof layer.route.path !== "string") continue;
        for (const method of Object.keys(layer.route.methods)) {
          out.push({ method: method.toUpperCase(), path: prefix + layer.route.path });
        }
      } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
        const mount = layer.regexp.source
          .replace("\\/?(?=\\/|$)", "")
          .replace(/^\^/, "")
          .replace(/\\\//g, "/");
        walk(layer.handle.stack, prefix + mount);
      }
    }
  };
  walk(expressApp._router.stack, "");
  return out.filter((r) => r.path.startsWith("/api/"));
}

// Fills :params with a syntactically valid id so the request reaches the guards.
const fillParams = (path) => path.replace(/:[A-Za-z0-9_]+/g, "000000000000000000000000").replace("/*", "/tenants/x/y/z.png");

module.exports = { listRoutes, fillParams };
