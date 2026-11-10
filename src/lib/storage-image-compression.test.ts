import sharp from "sharp";
import { expect, it } from "vitest";

import { compressStoredImage } from "./storage-image-compression";

it("캐스팅 표의 해상도와 픽셀을 그대로 보존하며 용량을 줄인다", async () => {
  const input = await sharp({
    create: { width: 800, height: 600, channels: 3, background: "white" },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="800" height="600"><text x="20" y="50" font-size="24">CASTING 2026-11-10 19:30</text><path d="M10 80H790V500H10Z" fill="none" stroke="black"/></svg>',
        ),
      },
    ])
    .png({ compressionLevel: 0 })
    .toBuffer();
  const result = await compressStoredImage(input);
  expect(result.changed).toBe(true);
  if (!result.changed) return;
  expect(result.width).toBe(800);
  expect(result.height).toBe(600);
  expect(result.buffer.length).toBeLessThan(input.length);
});

it("WebP 최대 크기를 넘는 긴 이미지는 PNG로 보존한다", async () => {
  const input = await sharp({
    create: { width: 10, height: 17000, channels: 3, background: "white" },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
  const result = await compressStoredImage(input);
  expect(result.changed).toBe(true);
  if (!result.changed) return;
  expect(result.contentType).toBe("image/png");
  expect(result.height).toBe(17000);
});

it("이미 압축된 작은 이미지는 더 큰 파일로 교체하지 않는다", async () => {
  const input = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "white" },
  })
    .webp({ lossless: true })
    .toBuffer();
  expect(await compressStoredImage(input)).toMatchObject({
    changed: false,
    reason: "not_smaller",
  });
});
