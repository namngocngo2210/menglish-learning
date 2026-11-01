import { fileURLToPath } from "node:url";

/** Frozen seed content shipped with the web app. */
export const CONTENT_DIR = fileURLToPath(new URL("../../web/content", import.meta.url));
