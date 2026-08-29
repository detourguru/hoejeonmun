import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const fontData = await readFile(
    join(process.cwd(), "src/app/fonts/MaruBuri-Bold.ttf"),
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: "#23285e",
        color: "#ffffff",
        fontFamily: "MaruBuri",
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 700 }}>{SITE_NAME}</div>
      <div style={{ fontSize: 32, color: "#ffd76a" }}>{SITE_DESCRIPTION}</div>
    </div>,
    {
      ...size,
      fonts: [{ name: "MaruBuri", data: fontData, weight: 700 }],
    },
  );
}
