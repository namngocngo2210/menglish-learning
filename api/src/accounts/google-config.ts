/** Google OIDC settings. Endpoints are configurable so tests can point at a fake provider. */
export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** Must equal `${ACCOUNTS_ORIGIN}/api/v1/account/oauth/google/callback` as registered at Google. */
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  issuers: readonly string[];
}

export const GOOGLE_DEFAULTS = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
  issuers: ["https://accounts.google.com", "accounts.google.com"],
} as const;
