import { SerwistProvider } from "@serwist/turbopack/react";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";

import { Toaster } from "@/components/toaster";

import type { Metadata, Viewport } from "next";

import "./globals.css";

const maruBuri = localFont({
  src: [
    { path: "./fonts/MaruBuri-ExtraLight.ttf", weight: "200", style: "normal" },
    { path: "./fonts/MaruBuri-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/MaruBuri-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/MaruBuri-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/MaruBuri-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-maruburi",
  display: "swap",
});

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
    <html lang="ko" className={maruBuri.variable}>
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
