import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACCOUNT_OPERATIONS } from "./account-openapi";
import { EXTRA_OPERATIONS } from "./admin-openapi";
import { allSpecs } from "./app";
import { buildOpenApi } from "./openapi";

/**
 * Regenerates api/openapi.v1.json (accounts off, what is served today) and
 * api/openapi.accounts.v1.json (ACCOUNTS_ENABLED=true): `npm run openapi -w @bj/api`.
 */
const unused = (): Promise<never> =>
  Promise.reject(new Error("not used while generating the document"));
const deps = {
  reader: {
    loadBundle: unused,
    ping: unused,
    close: unused,
    grades: unused,
    topics: unused,
    test: unused,
  },
  internalToken: undefined,
};
const write = (file: string, document: object): void => {
  writeFileSync(
    fileURLToPath(new URL(`../../${file}`, import.meta.url)),
    `${JSON.stringify(document, null, 2)}\n`,
  );
};
write("openapi.v1.json", buildOpenApi(allSpecs(deps)));
write(
  "openapi.accounts.v1.json",
  buildOpenApi(allSpecs({ ...deps, accountsDocs: true }), undefined, [
    ...EXTRA_OPERATIONS,
    ...ACCOUNT_OPERATIONS,
  ]),
);
