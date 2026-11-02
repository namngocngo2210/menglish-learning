/** Exact consent wording from docs/user-accounts.md 7.4. A test keeps these equal to the text the API hashes. */
export const ADULT_LABEL = "Tôi là cha/mẹ hoặc người giám hộ, từ đủ 18 tuổi.";
export const POLICY_LABEL_PREFIX = "Tôi đã đọc và đồng ý ";
export const POLICY_LINK_TEXT = "Chính sách quyền riêng tư";
export const TERMS_LINK_TEXT = "Điều khoản sử dụng";
export const POLICY_LABEL_SUFFIX = " của BeeJunior.";
export const ACCOUNT_CONSENT_TEXT = `${ADULT_LABEL} ${POLICY_LABEL_PREFIX}${POLICY_LINK_TEXT} và ${TERMS_LINK_TEXT}${POLICY_LABEL_SUFFIX}`;

export const CHILD_BEFORE = "Tôi đồng ý để BeeJunior lưu ";
export const CHILD_BOLD = "biệt danh, lớp và kết quả luyện tập";
export const CHILD_AFTER = " của con tôi để đồng bộ tiến độ. BeeJunior không hỏi họ tên thật, ngày sinh, số điện thoại, địa chỉ hay ảnh của con, và không dùng dữ liệu này để quảng cáo. Tôi có thể xem, tải về, xóa hồ sơ hoặc rút đồng ý bất cứ lúc nào tại Tài khoản › Hồ sơ của con.";
export const CHILD_CONSENT_TEXT = `${CHILD_BEFORE}${CHILD_BOLD}${CHILD_AFTER}`;
export const CHILD_HINT = "Hãy giải thích cho con và hỏi ý con trước khi tạo hồ sơ.";
