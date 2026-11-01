import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { breakingChanges } from "./openapi";
import type { OpenApiDocument } from "./openapi";

/**
 * `npm run openapi:compat -w @bj/api -- <baseline.json>`: fails when api/openapi.v1.json removes a path,
 * method or response status that the baseline (the file on main) still has (v1 is additive only).
 */
const baselinePath = process.argv[2];
if (baselinePath === undefined) throw new Error("usage: check-compat <baseline.json>");
const read = (path: string): OpenApiDocument =>
  JSON.parse(readFileSync(path, "utf8")) as OpenApiDocument;
const current = read(fileURLToPath(new URL("../../openapi.v1.json", import.meta.url)));
const issues = breakingChanges(read(baselinePath), current);
process.stdout.write(
  issues.length === 0 ? "openapi v1: additive only\n" : `${JSON.stringify(issues, null, 2)}\n`,
);
process.exit(issues.length === 0 ? 0 : 1);
