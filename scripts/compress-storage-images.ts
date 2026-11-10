/** Run with signed, object-scoped URLs. No service-role key is copied locally.
 * npx tsx scripts/compress-storage-images.ts /tmp/storage-signed.json [--apply]
 * Keep the private signed URL manifest out of git. Local backups are retained.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { compressStoredImage } from "../src/lib/storage-image-compression";

type SignedObject = {
  bucket: string;
  path: string;
  size: number;
  readUrl: string;
  writeUrl: string;
};
async function main() {
  const manifest = process.argv[2];
  if (!manifest)
    throw new Error(
      "Usage: compress-storage-images.ts manifest.json [--apply]",
    );
  const apply = process.argv.includes("--apply");
  const outputDir =
    process.env.STORAGE_MAINTENANCE_DIR ?? "/workspace/artifacts";
  const backupDir = path.join(outputDir, "storage-compression-backups");
  const reportPath = path.join(outputDir, "storage-compression-report.json");
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const { signed } = JSON.parse(await readFile(manifest, "utf8")) as {
    signed: SignedObject[];
  };
  const report: Record<string, unknown>[] = [];
  for (const [index, object] of signed.entries()) {
    try {
      const response = await fetch(object.readUrl, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
      const input = Buffer.from(await response.arrayBuffer());
      const result = await compressStoredImage(input);
      if (!result.changed) {
        report.push({
          bucket: object.bucket,
          path: object.path,
          originalBytes: input.length,
          changed: false,
          reason: result.reason,
        });
        console.log(
          `${index + 1}/${signed.length}: unchanged (${result.reason})`,
        );
        continue;
      }
      const backupName = createHash("sha256")
        .update(`${object.bucket}/${object.path}`)
        .digest("hex");
      await writeFile(path.join(backupDir, backupName), input, { mode: 0o600 });
      await writeFile(
        path.join(backupDir, `${backupName}.json`),
        JSON.stringify({
          bucket: object.bucket,
          path: object.path,
          originalBytes: input.length,
        }),
        { mode: 0o600 },
      );
      if (apply) {
        const upload = await fetch(object.writeUrl, {
          method: "PUT",
          headers: {
            "Content-Type": result.contentType,
            "Cache-Control": "max-age=3600",
            "x-upsert": "true",
          },
          body: new Uint8Array(result.buffer),
          signal: AbortSignal.timeout(60_000),
        });
        if (!upload.ok)
          throw new Error(
            `Upload HTTP ${upload.status}: ${await upload.text()}`,
          );
      }
      report.push({
        bucket: object.bucket,
        path: object.path,
        changed: true,
        applied: apply,
        originalBytes: input.length,
        compressedBytes: result.buffer.length,
        savedBytes: result.savedBytes,
        width: result.width,
        height: result.height,
        pixelIdentical: true,
        backupName,
      });
      console.log(
        `${index + 1}/${signed.length}: ${input.length} -> ${result.buffer.length} bytes${apply ? " uploaded" : " preview"}`,
      );
    } catch (error) {
      // Avoid logging signed URLs or tokens on request failures.
      const message = error instanceof Error ? error.message : String(error);
      report.push({
        bucket: object.bucket,
        path: object.path,
        error: message.replace(/https?:\/\/\S+/g, "[redacted URL]"),
      });
      console.log(`${index + 1}/${signed.length}: failed`);
    }
    await writeFile(reportPath, JSON.stringify(report, null, 2), {
      mode: 0o600,
    });
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify({
      files: report.length,
      changed: report.filter((row) => row.changed).length,
      errors: report.filter((row) => row.error).length,
      savedBytes: report.reduce(
        (sum, row) => sum + Number(row.savedBytes ?? 0),
        0,
      ),
      apply,
    }),
  );
}
main().catch(() => {
  console.error("Compression run failed; inspect the private report.");
  process.exitCode = 1;
});
