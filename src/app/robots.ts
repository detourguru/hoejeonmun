import { SITE_URL } from "@/lib/site";

import type { MetadataRoute } from "next";

const TRAINING_ONLY_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...TRAINING_ONLY_BOTS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/mypage", "/login", "/~offline"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
