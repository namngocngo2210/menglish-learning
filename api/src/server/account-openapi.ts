import type { ExtraOperation } from "./admin-openapi";

const P = "/api/v1/account";

const op = (
  method: ExtraOperation["method"],
  path: string,
  summary: string,
  tag: "account" | "account-public" = "account",
  ok: ExtraOperation["ok"] = 200,
): ExtraOperation => ({ method, path, summary, tag, ok });

/**
 * Parent-account operations. Documented only while ACCOUNTS_ENABLED=true (otherwise the routes do not
 * exist); a test pins this list to the real route table and to PUBLIC_ROUTES.
 */
export const ACCOUNT_OPERATIONS: readonly ExtraOperation[] = [
  op(
    "get",
    `${P}/consent-texts`,
    "Current consent texts, policy version and text hashes",
    "account-public",
  ),
  op(
    "post",
    `${P}/register`,
    "Register a parent (always 202, never reveals if the email exists)",
    "account-public",
    202,
  ),
  op(
    "post",
    `${P}/verify-email`,
    "Verify the email token, activate the account and log in",
    "account-public",
  ),
  op("post", `${P}/login`, "Log in with email and password", "account-public"),
  op(
    "post",
    `${P}/password-reset/request`,
    "Email a reset link (always 202)",
    "account-public",
    202,
  ),
  op(
    "post",
    `${P}/password-reset/confirm`,
    "Set a new password from a reset token; revokes all sessions",
    "account-public",
  ),
  op(
    "get",
    `${P}/oauth/google/start`,
    "Start Google sign-in (302 to Google; 404 unless Google is configured)",
    "account-public",
  ),
  op(
    "get",
    `${P}/oauth/google/callback`,
    "Google redirect target: verifies state, PKCE and ID token, then 302 to the site",
    "account-public",
  ),
  op("post", `${P}/logout`, "Log out this session"),
  op("post", `${P}/logout-all`, "Revoke every session of the account"),
  op("get", `${P}/me`, "Current parent and CSRF token"),
  op("post", `${P}/password`, "Change password; revokes the other sessions"),
  op("get", `${P}/profiles`, "List child profiles"),
  op(
    "post",
    `${P}/profiles`,
    "Create a child profile with the parent's consent (max 5)",
    "account",
    201,
  ),
  op("patch", `${P}/profiles/{id}`, "Update a child profile"),
  op("delete", `${P}/profiles/{id}`, "Delete a child profile and its data", "account", 204),
  op(
    "post",
    `${P}/profiles/{id}/progress`,
    "Import the child's local progress after parent confirmation",
  ),
  op("get", `${P}/consents`, "List consents"),
  op(
    "post",
    `${P}/consents/{id}/withdraw`,
    "Withdraw a child's consent (deletes the profile)",
    "account",
    204,
  ),
  op("get", `${P}/export`, "Download all account data as JSON (rate limited)"),
  op("delete", `${P}/account`, "Delete the account and all its data", "account", 204),
];
