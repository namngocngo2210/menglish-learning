export const loginPath = () => "/dang-nhap";
export const registerPath = () => "/dang-ky";
export const accountPath = () => "/tai-khoan";
export const verifyEmailPath = () => "/xac-minh-email";
export const resetPasswordPath = () => "/dat-lai-mat-khau";
export const termsPath = () => "/dieu-khoan";
export const deleteDataPath = () => "/xoa-du-lieu";
/** Pages that must stay out of search results, no-referrer and uncached (token links, private state). */
export const ACCOUNT_PRIVATE_PATHS = [loginPath(), registerPath(), accountPath(), verifyEmailPath(), resetPasswordPath()];
