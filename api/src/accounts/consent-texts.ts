import { sha256Hex } from "../admin/crypto";

/**
 * Consent copy shown to the parent (docs/user-accounts.md 7.4). The server owns the text so a consent
 * row can prove exactly what was shown: clients echo policyVersion + textHash and a stale pair is refused.
 * Draft wording until the lawyer review in the plan; bump POLICY_VERSION whenever any text changes.
 */
export const POLICY_VERSION = "2026-11-draft-1";

export const CONSENT_PURPOSES = ["account", "child_progress"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

const TEXTS: Record<ConsentPurpose, string> = {
  account:
    "Tôi là cha/mẹ hoặc người giám hộ, từ đủ 18 tuổi. Tôi đã đọc và đồng ý Chính sách quyền riêng tư và Điều khoản sử dụng của BeeJunior.",
  child_progress:
    "Tôi đồng ý để BeeJunior lưu biệt danh, lớp và kết quả luyện tập của con tôi để đồng bộ tiến độ. BeeJunior không hỏi họ tên thật, ngày sinh, số điện thoại, địa chỉ hay ảnh của con, và không dùng dữ liệu này để quảng cáo. Tôi có thể xem, tải về, xóa hồ sơ hoặc rút đồng ý bất cứ lúc nào tại Tài khoản › Hồ sơ của con.",
};

export const CONSENT_TEXTS = Object.fromEntries(
  CONSENT_PURPOSES.map((purpose) => [
    purpose,
    { text: TEXTS[purpose], textHash: sha256Hex(TEXTS[purpose]) },
  ]),
) as Record<ConsentPurpose, { text: string; textHash: string }>;

export function consentMatches(
  purpose: ConsentPurpose,
  given: { policyVersion: string; textHash: string },
): boolean {
  return (
    given.policyVersion === POLICY_VERSION && given.textHash === CONSENT_TEXTS[purpose].textHash
  );
}
