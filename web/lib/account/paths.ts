export const loginPath = () => "/log-in";
export const registerPath = () => "/sign-up";
export const accountPath = () => "/account";
export const verifyEmailPath = () => "/verify-email";
export const resetPasswordPath = () => "/reset-password";
export const termsPath = () => "/terms";
export const deleteDataPath = () => "/delete-data";
/** Pages that must stay out of search results, no-referrer and uncached (token links, private state). */
export const ACCOUNT_PRIVATE_PATHS = [loginPath(), registerPath(), accountPath(), verifyEmailPath(), resetPasswordPath()];
