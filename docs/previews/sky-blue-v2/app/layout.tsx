import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Góc tiếng Anh (Tên tạm) - Bản xem trước giao diện',
  description: 'Bản xem trước giao diện hỗ trợ học tập môn tiếng Anh cho học sinh THCS (Lớp 6–9)',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="antialiased min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        {children}
      </body>
    </html>
  );
}
