import { SerwistProvider } from "@serwist/turbopack/react";
import { Analytics } from "@vercel/analytics/next";

import { Toaster } from "@/components/toaster";

import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "회전문 | Hoejeonmun",
  description: "티켓팅 전에 확인하는 뮤지컬/연극 캐스팅 정보",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "회전문",
  },
};

export const viewport: Viewport = {
  themeColor: "#23285e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* next/font는 한글(Hangul) 서브셋을 지원하지 않아 Gowun Batang은 직접 링크로 로드 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- 루트 layout 전역 적용이라 해당 없음 */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap"
        />
      </head>
      <Analytics />
      <body className="bg-primary">
        <SerwistProvider swUrl="/serwist/sw.js">
          {children}
          <Toaster />
        </SerwistProvider>
      </body>
    </html>
  );
}
