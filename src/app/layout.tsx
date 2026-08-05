import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "회전문 | Hoejeonmun",
  description: "공연 관련 정보를 제공하는 웹 애플리케이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-primary">{children}</body>
    </html>
  );
}
