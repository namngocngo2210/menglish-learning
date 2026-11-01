import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allSpecs } from "./app";
import { buildOpenApi } from "./openapi";

/** Regenerates api/openapi.v1.json from the route specs: `npm run openapi -w @bj/api`. */
const out = fileURLToPath(new URL("../../openapi.v1.json", import.meta.url));
const unused = (): Promise<never> =>
  Promise.reject(new Error("not used while generating the document"));
const specs = allSpecs({
  reader: {
    loadBundle: unused,
    ping: unused,
    close: unused,
    grades: unused,
    topics: unused,
    test: unused,
  },
  internalToken: undefined,
});
writeFileSync(out, `${JSON.stringify(buildOpenApi(specs), null, 2)}\n`);
