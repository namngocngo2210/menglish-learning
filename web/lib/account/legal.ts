/** Owner-provided values: never invent an entity or contact. Replace when the owner supplies them. */
export const LEGAL = {
 entity: "[TÊN PHÁP NHÂN]",
 contact: "[EMAIL LIÊN HỆ]",
 effective: "[NGÀY HIỆU LỰC]",
 emailProvider: "[NHÀ GỬI EMAIL]",
 /** Same string as POLICY_VERSION in api/src/accounts/consent-texts.ts (a test keeps them equal). */
 version: "2026-11-draft-1",
} as const;
export const DRAFT_NOTICE = "BẢN NHÁP — đang chờ luật sư rà soát và chủ phê duyệt; chưa có hiệu lực pháp lý.";
