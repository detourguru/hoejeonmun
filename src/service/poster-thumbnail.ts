import { type AdminClient, createAdminClient } from "@/lib/supabase/admin";

export const POSTER_THUMBNAIL_BUCKET = "poster-thumbnails";

// PostgREST in 필터가 URL 길이 제한에 걸리지 않게 나눠 조회한다
export const LOOKUP_CHUNK_SIZE = 200;

export type PosterTarget = {
  showId: string;
  poster?: string | null;
};

export type ThumbnailRow = {
  show_id: string;
  source_url: string;
  path: string;
};

const KOPIS_POSTER_HOSTS = new Set(["kopis.or.kr", "www.kopis.or.kr"]);

export function normalizePosterUrl(url: string) {
  try {
    const parsed = new URL(url.trim());

    if (KOPIS_POSTER_HOSTS.has(parsed.hostname)) {
      return `kopis.or.kr${parsed.pathname}${parsed.search}`;
    }

    return parsed.href;
  } catch {
    return url.trim();
  }
}

export const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );

export async function getThumbnailRows(
  showIds: string[],
  admin: AdminClient = createAdminClient(),
) {
  const results = await Promise.all(
    chunk(showIds, LOOKUP_CHUNK_SIZE).map((ids) =>
      admin
        .from("poster_thumbnails")
        .select("show_id, source_url, path")
        .in("show_id", ids),
    ),
  );

  const rows: ThumbnailRow[] = [];

  for (const { data, error } of results) {
    if (error) throw error;

    rows.push(...(data as ThumbnailRow[]));
  }

  return new Map(rows.map((row) => [row.show_id, row]));
}

export async function getPosterThumbnailUrls(
  targets: PosterTarget[],
): Promise<Map<string, string>> {
  const withPoster = targets.filter(
    (target): target is { showId: string; poster: string } => !!target.poster,
  );

  if (withPoster.length === 0) return new Map();

  try {
    const rows = await getThumbnailRows([
      ...new Set(withPoster.map(({ showId }) => showId)),
    ]);
    const storage = createAdminClient().storage.from(POSTER_THUMBNAIL_BUCKET);
    const urls = new Map<string, string>();

    for (const { showId, poster } of withPoster) {
      const row = rows.get(showId);

      if (!row || row.source_url !== normalizePosterUrl(poster)) continue;

      urls.set(showId, storage.getPublicUrl(row.path).data.publicUrl);
    }

    return urls;
  } catch (error) {
    console.error("포스터 썸네일 조회 실패, 원본 포스터를 사용합니다", error);

    return new Map();
  }
}

export async function withPosterThumbnails<
  T extends { mt20id: string; poster: string },
>(shows: T[]): Promise<T[]> {
  const urls = await getPosterThumbnailUrls(
    shows.map(({ mt20id, poster }) => ({ showId: mt20id, poster })),
  );

  return shows.map((show) => ({
    ...show,
    poster: urls.get(show.mt20id) ?? show.poster,
  }));
}
