import { createHash, randomUUID } from "node:crypto";

import { getToday, toKopisDate, toIsoDate } from "@/lib/date";
import { toArray } from "@/lib/kopis";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hasKnownCastOverlap,
  parseCastingBoard,
  saveCastingBoard,
} from "@/service/casting-board";
import { getShow } from "@/service/show";
import { CASTING_BOARD_BUCKET } from "@/type/casting";
import type { Show, ShowDetail } from "@/type/show";

export type DiscoveryResult =
  | { showId: string; outcome: "saved"; slotCount: number }
  | { showId: string; outcome: "duplicate" }
  | { showId: string; outcome: "not_casting" }
  | { showId: string; outcome: "stale" }
  | { showId: string; outcome: "no_image" }
  | { showId: string; outcome: "show_not_found" }
  | { showId: string; outcome: "failed"; error: string };

const sha256 = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

// KOPIS 소개 이미지 중 마지막 장이 캐스팅보드인 경우가 있어 후보로 삼는다
async function fetchLastStoryImage(show: ShowDetail) {
  const urls = toArray(show.styurls?.styurl);
  const url = urls.at(-1);

  if (!url) return null;

  const response = await fetch(url);

  if (!response.ok) return null;

  return response.blob();
}

function hasCurrentOrFutureDate(performances: { date: string }[]) {
  const today = toIsoDate(toKopisDate(getToday()));

  return performances.some(({ date }) => date >= today);
}

export async function discoverCastingFromKopis(
  show: Pick<Show, "mt20id">,
  systemUserId: string,
): Promise<DiscoveryResult> {
  const showId = show.mt20id;
  const admin = createAdminClient();

  const detail = await getShow(showId);

  if (!detail) return { showId, outcome: "show_not_found" };

  const blob = await fetchLastStoryImage(detail);

  if (!blob) return { showId, outcome: "no_image" };

  const buffer = Buffer.from(await blob.arrayBuffer());
  const hash = sha256(buffer);

  const { data: existing, error: existingError } = await admin
    .from("upload_images")
    .select("id")
    .eq("show_id", showId)
    .eq("image_hash", hash)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return { showId, outcome: "duplicate" };

  try {
    const { performances } = await parseCastingBoard([blob], detail);

    if (performances.length === 0) return { showId, outcome: "not_casting" };

    if (!hasKnownCastOverlap(performances, detail)) {
      return { showId, outcome: "not_casting" };
    }

    if (!hasCurrentOrFutureDate(performances)) {
      return { showId, outcome: "stale" };
    }

    const storagePath = `${systemUserId}/${showId}/${randomUUID()}.jpg`;

    const { error: uploadError } = await admin.storage
      .from(CASTING_BOARD_BUCKET)
      .upload(storagePath, buffer, { contentType: "image/jpeg" });

    if (uploadError) throw uploadError;

    const result = await saveCastingBoard({
      showId,
      userId: systemUserId,
      storagePaths: [storagePath],
      performances,
      events: [],
      skipped: [],
      source: "system",
    });

    return { showId, outcome: "saved", slotCount: result.slotCount };
  } catch (error) {
    return {
      showId,
      outcome: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
