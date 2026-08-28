import { SerwistProvider } from "@serwist/turbopack/react";
import { Analytics } from "@vercel/analytics/next";

import { Toaster } from "@/components/toaster";

import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "회전문 | Hoejeonmun",
  description: "공연 관련 정보를 제공하는 웹 애플리케이션",
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
      <Analytics/>
      <body className="bg-primary">
        <SerwistProvider swUrl="/serwist/sw.js">
          {children}
          <Toaster />
        </SerwistProvider>
      </body>
    </html>
  );
}
