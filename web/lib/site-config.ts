export const SITE = {
 name: "BeeJunior",
 wordmark: "BeeJunior",
 description: "Luyện tiếng Anh miễn phí với câu hỏi từ bài đọc VOA Learning English và giải thích tiếng Việt.",
 logo: { lockup: "/brand/logo-lockup.webp", full: "/brand/logo-full.webp", mascot: "/brand/mascot.webp", ogImage: "/brand/og-image.png" },
 tagline: "Cùng học tiếng Anh mỗi ngày",
 baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://beejunior.meducation.vn",
} as const;
