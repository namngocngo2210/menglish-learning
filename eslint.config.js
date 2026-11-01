// Root ESLint flat config. `web/` keeps its own config (eslint-config-next) and is NOT linted from here.
//
// Ratchet (docs/engineering-standards.md): new code (packages/, api/, worker/, admin/, scripts/)
// gets the strict, type-aware rule set as ERRORS. Legacy trees (rooms/, crawler/) get a baseline
// where the rules the owner cares most about (`any`, floating promises) are WARNINGS; promote them
// to errors in the PR that cleans each tree, then delete its entry from LEGACY below.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

const STRICT_FILES = ["packages/**/*.{ts,tsx}", "api/**/*.ts", "worker/**/*.ts", "admin/**/*.{ts,tsx}"];
const LEGACY_FILES = ["rooms/**/*.ts", "crawler/**/*.ts"];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "web/**",
      "docs/**",
      "db/migrations/**",
      "**/*.generated.ts",
    ],
  },
  js.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },

  // --- New code: strict + type-aware, errors ---
  {
    files: STRICT_FILES,
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "variable", filter: { regex: "Schema$", match: true }, format: ["PascalCase"] }, // zod schemas (GradeSchema)
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"], leadingUnderscore: "allow" },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
        { selector: "property", format: null }, // wire/DB names (snake_case, headers) are allowed
        { selector: "import", format: null },
      ],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/dot-notation": ["error", { allowIndexSignaturePropertyAccess: true }], // pairs with noPropertyAccessFromIndexSignature
      "no-console": "error", // use the pino logger
      "no-restricted-syntax": [
        "error",
        { selector: "TSEnumDeclaration:not([const=true])", message: "Use a union of string literals or `as const` object, not enum." },
        {
          selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
          message: "sql.raw is forbidden: use parameterised Kysely expressions (engineering-standards §5).",
        },
      ],
      eqeqeq: ["error", "always"],
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Read configuration once in config.ts (loadConfig); pass it as a parameter." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Outbound HTTP goes through safe-fetch (SSRF guard); do not call fetch directly." },
      ],
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["../*/src/*", "**/internal/*"], message: "Import a package through its public entry point only." }] },
      ],
    },
  },
  // Admin SPA runs in the browser: React components are PascalCase and it talks to its own origin with fetch.
  {
    files: ["admin/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "variable", filter: { regex: "Schema$", match: true }, format: ["PascalCase"] },
        { selector: ["function", "variable", "parameter"], format: ["camelCase", "PascalCase", "UPPER_CASE"], leadingUnderscore: "allow", trailingUnderscore: "allow" },
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "property", format: null },
        { selector: "import", format: null },
      ],
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
    },
  },
  // The only places allowed to touch process.env: the config loader and the CLI entry.
  { files: ["**/config.ts", "api/src/main.ts", "packages/edge/src/main.ts", "**/tests/**/*.ts"], rules: { "no-restricted-properties": "off" } },
  // Test files may be looser on a few type-aware rules.
  {
    files: ["**/*.test.ts", "**/tests/**/*.ts", "**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "no-console": "off",
    },
  },

  // --- Legacy code: baseline, `any`/floating promises are warnings (ratchet) ---
  {
    files: LEGACY_FILES,
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "no-control-regex": "warn",
      "prefer-const": "warn",
    },
  },

  // core is I/O-free (also enforced structurally by dependency-cruiser).
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*/src/*", "**/internal/*"],
              message: "Import a package through its public entry point only.",
            },
          ],
          paths: ["node:fs", "node:fs/promises", "node:net", "node:http", "node:https", "node:child_process", "node:dns", "pg", "kysely", "fastify"].map((name) => ({
            name,
            message: "packages/core must not perform I/O. Put it in api/ or worker/ behind an interface.",
          })),
        },
      ],
      "no-restricted-globals": ["error", "fetch", "process"],
    },
  },

  // Repo scripts are plain ESM JS.
  { files: ["scripts/**/*.mjs", "*.config.js", "*.cjs"], languageOptions: { sourceType: "module" } },
  prettier,
);
