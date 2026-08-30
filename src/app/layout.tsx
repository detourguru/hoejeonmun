import { SerwistProvider } from "@serwist/turbopack/react";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";

import { Toaster } from "@/components/toaster";
import { UpdateToast } from "@/components/update-toast";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

import type { Metadata, Viewport } from "next";

import "./globals.css";

const maruBuri = localFont({
  src: [
    { path: "./fonts/MaruBuri-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/MaruBuri-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-maruburi",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: `%s | ${SITE_NAME}`,
    default: `${SITE_NAME} | ${SITE_DESCRIPTION}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "뮤지컬 캐스팅",
    "연극 캐스팅",
    "캐스팅보드",
    "뮤지컬 회차",
    "배우 스케줄",
    "회전문",
  ],
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_DESCRIPTION}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_DESCRIPTION}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#23285e",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <SerwistProvider swUrl="/serwist/sw.js">
          {children}
          <Toaster />
          <UpdateToast />
        </SerwistProvider>
      </body>
    </html>
  );
}
