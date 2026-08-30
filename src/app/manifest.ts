import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "회전문",
    short_name: "회전문",
    description: "한눈에 확인하는 뮤지컬/연극 캐스팅 및 이벤트 정보",
    start_url: "/",
    display: "standalone",
    background_color: "#23285e",
    theme_color: "#23285e",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
