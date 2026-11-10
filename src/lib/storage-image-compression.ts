import sharp from "sharp";

const MAX_WEBP_DIMENSION = 16383;
const MIN_SAVINGS_BYTES = 1024;
const DECODE_OPTIONS = { limitInputPixels: 80_000_000 };

/** Re-encode without resizing or changing any displayed pixel. */
export async function compressStoredImage(input: Buffer) {
  const image = sharp(input, DECODE_OPTIONS);
  const metadata = await image.metadata();
  if ((metadata.pages ?? 1) > 1)
    return { changed: false as const, reason: "animated" };
  const oriented = image.rotate().toColourspace("srgb");
  const { data: originalPixels, info } = await oriented
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const webp =
    info.width <= MAX_WEBP_DIMENSION && info.height <= MAX_WEBP_DIMENSION;
  const encoded = webp
    ? await oriented.clone().webp({ lossless: true, effort: 6 }).toBuffer()
    : await oriented
        .clone()
        .png({ compressionLevel: 9, effort: 10 })
        .toBuffer();
  if (encoded.length >= input.length - MIN_SAVINGS_BYTES)
    return { changed: false as const, reason: "not_smaller" };
  const { data: resultPixels, info: resultInfo } = await sharp(
    encoded,
    DECODE_OPTIONS,
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    info.width !== resultInfo.width ||
    info.height !== resultInfo.height ||
    !originalPixels.equals(resultPixels)
  ) {
    throw new Error("Lossless compression pixel verification failed");
  }
  return {
    changed: true as const,
    buffer: encoded,
    contentType: webp ? "image/webp" : "image/png",
    width: info.width,
    height: info.height,
    savedBytes: input.length - encoded.length,
  };
}
