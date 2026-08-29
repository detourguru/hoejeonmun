import { execSync } from "node:child_process";

import { withSerwist } from "@serwist/turbopack";

import type { NextConfig } from "next";

const supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
  .hostname;

function resolveCommitSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA)
    return process.env.VERCEL_GIT_COMMIT_SHA;

  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: {
    APP_COMMIT_SHA: resolveCommitSha(),
  },
  images: {
    // KOPIS 가 www 없이 주거나 https 로 주는 경우가 있음
    remotePatterns: [
      {
        protocol: "http",
        hostname: "**.kopis.or.kr",
        pathname: "/upload/**",
      },
      {
        protocol: "https",
        hostname: "**.kopis.or.kr",
        pathname: "/upload/**",
      },
      {
        protocol: "http",
        hostname: "kopis.or.kr",
        pathname: "/upload/**",
      },
      {
        protocol: "https",
        hostname: "kopis.or.kr",
        pathname: "/upload/**",
      },
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/sign/casting-boards/**",
      },
    ],
  },
};

export default withSerwist(nextConfig);
