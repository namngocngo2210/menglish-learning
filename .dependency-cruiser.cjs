/** Module-boundary rules. See docs/engineering-standards.md §1. Violations are errors. */
const APPS = "^(api|worker|admin|web|rooms|crawler)/";

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Cycles make load order and tests fragile.",
      from: {},
      to: { circular: true },
    },
    {
      name: "core-is-pure",
      severity: "error",
      comment: "packages/core must not import any app (api, worker, admin, web, rooms, crawler).",
      from: { path: "^packages/core/" },
      to: { path: APPS },
    },
    {
      name: "core-no-io-libs",
      severity: "error",
      comment: "packages/core has no I/O: no DB, HTTP framework, network or filesystem modules.",
      from: { path: "^packages/core/" },
      to: {
        dependencyTypes: ["npm", "core"],
        path: "^(pg|kysely|fastify|undici|node-fetch|axios|fs|net|http|https|child_process|dns)(/|$)|^node:",
      },
    },
    {
      name: "api-worker-isolated",
      severity: "error",
      comment: "api and worker share code only through packages/*.",
      from: { path: "^api/" },
      to: { path: "^worker/" },
    },
    {
      name: "worker-not-api",
      severity: "error",
      from: { path: "^worker/" },
      to: { path: "^api/" },
    },
    {
      name: "web-not-api-internals",
      severity: "error",
      comment:
        "web/admin talk to api over HTTP (OpenAPI types), never by importing api or worker source.",
      from: { path: "^(web|admin)/" },
      to: { path: "^(api|worker)/" },
    },
    {
      name: "packages-not-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: APPS },
    },
    {
      name: "no-deep-package-imports",
      severity: "error",
      comment: "Import packages through their public entry (packages/<name>/src/index.ts).",
      from: { path: APPS },
      to: { path: "^packages/[^/]+/src/(?!index\\.ts$)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(node_modules|dist|\\.next|coverage)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
