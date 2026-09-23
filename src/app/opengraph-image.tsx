import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [fontData, logoData] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/MaruBuri-Bold.ttf")),
    readFile(join(process.cwd(), "public/icon-512x512.png")),
  ]);
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "0 110px",
        gap: 72,
        background: "linear-gradient(135deg, #1a1c3c 0%, #23285e 55%, #3a4184 100%)",
        color: "#ffffff",
        fontFamily: "MaruBuri",
      }}
    >
      <div
        style={{
          width: 300,
          height: 300,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: 72,
          boxShadow: "0 24px 60px rgba(10, 11, 30, 0.45)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={250} height={250} alt="" />
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 150, lineHeight: 1, letterSpacing: -4 }}>
          {SITE_NAME}
        </div>
        <div
          style={{
            width: 96,
            height: 10,
            margin: "36px 0 32px",
            borderRadius: 5,
            background: "#ffd76a",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 46,
            lineHeight: 1.35,
            color: "#e4e6f5",
          }}
        >
          <div style={{ display: "flex" }}>
            <span style={{ color: "#ffd76a" }}>공연 이벤트</span>부터
          </div>
          <div style={{ display: "flex" }}>
            <span style={{ color: "#ffd76a" }}>회차 관리</span>까지 한번에
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: "MaruBuri", data: fontData, weight: 700 }],
    },
  );
}
