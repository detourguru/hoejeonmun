import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
