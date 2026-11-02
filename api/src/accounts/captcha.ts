export interface Captcha {
  verify(token: string | undefined, ip: string): Promise<boolean>;
}

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// The only target is the fixed Cloudflare URL (never user input), same reasoning as providerFetch in google.ts.
// eslint-disable-next-line no-restricted-globals
const defaultFetch = fetch;

export function createTurnstileVerifier(
  secret: string,
  fetchImpl: typeof fetch = defaultFetch,
): Captcha {
  return {
    async verify(token, ip) {
      if (token === undefined || token === "") return false;
      try {
        const res = await fetchImpl(SITEVERIFY, {
          method: "POST",
          body: new URLSearchParams({ secret, response: token, remoteip: ip }),
          signal: AbortSignal.timeout(3000),
        });
        const body = (await res.json()) as { success?: unknown };
        return res.ok && body.success === true;
      } catch {
        return false;
      }
    },
  };
}
