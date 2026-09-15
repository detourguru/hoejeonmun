import "server-only";

import { createHash } from "node:crypto";

import sharp from "sharp";

import { type AdminClient, createAdminClient } from "@/lib/supabase/admin";
import {
  chunk,
  getThumbnailRows,
  LOOKUP_CHUNK_SIZE,
  normalizePosterUrl,
  POSTER_THUMBNAIL_BUCKET,
  type PosterTarget,
  type ThumbnailRow,
} from "@/service/poster-thumbnail";
import { getShows } from "@/service/show";
import { USER_SHOW_POSTER_BUCKET } from "@/type/user-show";

// 목록 카드 포스터 표시 폭 * 3
const THUMBNAIL_WIDTH = 288;
const THUMBNAIL_QUALITY = 75;

const FETCH_TIMEOUT_MS = 20_000;
// 다운로드가 끝난 뒤 후처리 시간
const PROCESS_RESERVE_MS = 8_000;
// 변환이 끝난 뒤 후처리 시간
const POST_CONVERT_RESERVE_MS = 4_000;
// 변환에 주는 최대 시간 (s)
const CONVERT_TIMEOUT_MAX_S = 10;

const MIN_FETCH_MS = 5_000;
const STEP_TIMEOUT_MS = 5_000;
// 포스터가 바뀐 뒤 예전 썸네일 파일을 남겨 두는 기간
const STALE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_CLEANUP_BATCH = 100;
const USER_SHOW_THUMBNAIL_BUDGET_MS = 30_000;

const timeLeft = (deadline: number, max: number) =>
  Math.max(0, Math.min(max, deadline - Date.now()));

export function createDeadlineClient(deadline: number): AdminClient {
  return createAdminClient({
    fetch: (input, init) => {
      const timeout = AbortSignal.timeout(timeLeft(deadline, STEP_TIMEOUT_MS));
      const signal = init?.signal
        ? AbortSignal.any([init.signal, timeout])
        : timeout;

      return fetch(input, { ...init, signal });
    },
  });
}

export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label: string,
): Promise<T> {
  if (!Number.isFinite(ms)) return Promise.resolve(promise);

  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} 시간 초과(${ms}ms)`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);

export async function mustSucceed(
  request: PromiseLike<{ error: unknown }>,
  label: string,
) {
  const { error } = await request;

  if (error) throw new Error(`${label}: ${errorText(error)}`);
}

export async function getPosterThumbnailTargets(
  deadline = Infinity,
): Promise<PosterTarget[]> {
  const admin = createDeadlineClient(deadline);

  const [shows, { data: userShows, error }] = await Promise.all([
    getShows(),
    admin.from("user_shows").select("id, poster_path"),
  ]);

  if (error) throw error;

  const storage = admin.storage.from(USER_SHOW_POSTER_BUCKET);

  return [
    ...shows.map(({ mt20id, poster }) => ({ showId: mt20id, poster })),
    ...(userShows as { id: string; poster_path: string }[]).map(
      ({ id, poster_path }) => ({
        showId: id,
        poster: storage.getPublicUrl(poster_path).data.publicUrl,
      }),
    ),
  ];
}

// 새로 등록된 공연은 다음 날 크론까지 원본이 나가므로 등록 직후 한 번 만든다. 실패하면 크론이 다시 시도한다
export async function generateUserShowThumbnail(
  showId: string,
  posterPath: string,
) {
  const poster = createAdminClient()
    .storage.from(USER_SHOW_POSTER_BUCKET)
    .getPublicUrl(posterPath).data.publicUrl;

  try {
    const { failed, bookkeepingErrors } = await generatePosterThumbnails(
      [{ showId, poster }],
      { deadline: Date.now() + USER_SHOW_THUMBNAIL_BUDGET_MS },
    );

    if (failed.length > 0 || bookkeepingErrors.length > 0) {
      console.error(
        "등록 공연 썸네일 생성 실패",
        showId,
        failed,
        bookkeepingErrors,
      );
    }
  } catch (error) {
    console.error("등록 공연 썸네일 생성 실패", showId, error);
  }
}

type FailureRow = {
  show_id: string;
  source_url: string;
  attempts: number;
  last_attempt_at: string;
};

async function getFailureRows(showIds: string[], admin: AdminClient) {
  const results = await Promise.all(
    chunk(showIds, LOOKUP_CHUNK_SIZE).map((ids) =>
      admin
        .from("poster_thumbnail_failures")
        .select("show_id, source_url, attempts, last_attempt_at")
        .in("show_id", ids),
    ),
  );

  const rows: FailureRow[] = [];

  for (const { data, error } of results) {
    if (error) throw error;

    rows.push(...(data as FailureRow[]));
  }

  return new Map(rows.map((row) => [row.show_id, row]));
}

export async function cleanupStaleThumbnails(
  deadline = Infinity,
): Promise<number> {
  const admin = createDeadlineClient(deadline);
  const cutoff = new Date(Date.now() - STALE_RETENTION_MS).toISOString();

  const { data, error } = await admin
    .from("poster_thumbnail_stale_files")
    .select("path")
    .lt("replaced_at", cutoff)
    .limit(STALE_CLEANUP_BATCH);

  if (error) throw error;

  const candidates = (data as { path: string }[]).map(({ path }) => path);

  if (candidates.length === 0) return 0;

  const { data: liveRows, error: liveError } = await admin
    .from("poster_thumbnails")
    .select("path")
    .in("path", candidates);

  if (liveError) throw liveError;

  const live = new Set(
    (liveRows as { path: string }[]).map(({ path }) => path),
  );
  const removable = candidates.filter((path) => !live.has(path));

  if (removable.length > 0) {
    const { error: removeError } = await admin.storage
      .from(POSTER_THUMBNAIL_BUCKET)
      .remove(removable);

    if (removeError) throw removeError;
  }

  await mustSucceed(
    admin.from("poster_thumbnail_stale_files").delete().in("path", candidates),
    "예전 썸네일 기록 삭제",
  );

  return removable.length;
}

export type PosterThumbnailResult = {
  total: number;
  alreadyDone: number;
  generated: number;
  retried: number;
  failed: { showId: string; poster: string; error: string }[];
  bookkeepingErrors: string[];
  remaining: number;
  sourceBytes: number;
  thumbnailBytes: number;
};

export type GenerateOptions = {
  deadline?: number;
  concurrency?: number;
  dryRun?: boolean;
};

export async function createThumbnail(
  poster: string,
  { fetchTimeoutMs, deadline }: { fetchTimeoutMs: number; deadline: number },
) {
  const response = await fetch(poster, {
    cache: "no-store",
    signal: AbortSignal.timeout(fetchTimeoutMs),
  });

  if (!response.ok) {
    // 읽지 않은 본문이 연결을 붙잡지 않게 닫는다
    await response.body?.cancel();

    throw new Error(`원본 포스터 응답 ${response.status}`);
  }

  const source = Buffer.from(await response.arrayBuffer());

  const convertSeconds = Math.min(
    CONVERT_TIMEOUT_MAX_S,
    Math.floor((deadline - Date.now() - POST_CONVERT_RESERVE_MS) / 1000),
  );

  if (convertSeconds < 1) {
    throw new Error("변환할 시간이 부족해 건너뜀");
  }

  const thumbnail = await sharp(source, { animated: false })
    .timeout({ seconds: convertSeconds })
    .rotate()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  return { source, thumbnail };
}

export function orderPending(
  pending: { showId: string; poster: string }[],
  failures: Map<string, FailureRow>,
) {
  const failureOf = ({
    showId,
    poster,
  }: {
    showId: string;
    poster: string;
  }) => {
    const failure = failures.get(showId);

    return failure?.source_url === normalizePosterUrl(poster)
      ? failure
      : undefined;
  };

  const fresh = pending.filter((item) => !failureOf(item));
  const retry = pending
    .filter((item) => failureOf(item))
    .sort((a, b) =>
      failureOf(a)!.last_attempt_at.localeCompare(
        failureOf(b)!.last_attempt_at,
      ),
    );

  return { ordered: [...fresh, ...retry], failureOf };
}

export async function generatePosterThumbnails(
  targets: PosterTarget[],
  {
    deadline = Infinity,
    concurrency = 4,
    dryRun = false,
  }: GenerateOptions = {},
): Promise<PosterThumbnailResult> {
  const unique = new Map<string, string>();

  for (const { showId, poster } of targets) {
    if (poster && !unique.has(showId)) unique.set(showId, poster);
  }

  const showIds = [...unique.keys()];
  const admin = createDeadlineClient(deadline);
  const storage = admin.storage.from(POSTER_THUMBNAIL_BUCKET);

  const tolerateInDryRun =
    <T>(fallback: T) =>
    (error: unknown): T => {
      if (dryRun) return fallback;

      throw error;
    };

  const [existing, failures] = await Promise.all([
    getThumbnailRows(showIds, admin).catch(
      tolerateInDryRun(new Map<string, ThumbnailRow>()),
    ),
    getFailureRows(showIds, admin).catch(
      tolerateInDryRun(new Map<string, FailureRow>()),
    ),
  ]);

  const { ordered: pending, failureOf } = orderPending(
    [...unique.entries()]
      .filter(
        ([showId, poster]) =>
          existing.get(showId)?.source_url !== normalizePosterUrl(poster),
      )
      .map(([showId, poster]) => ({ showId, poster })),
    failures,
  );

  const result: PosterThumbnailResult = {
    total: unique.size,
    alreadyDone: unique.size - pending.length,
    generated: 0,
    retried: 0,
    failed: [],
    bookkeepingErrors: [],
    remaining: 0,
    sourceBytes: 0,
    thumbnailBytes: 0,
  };

  const bookkeep = async (
    request: PromiseLike<{ error: unknown }>,
    label: string,
  ) => {
    try {
      await mustSucceed(request, label);
    } catch (error) {
      console.error(error);
      result.bookkeepingErrors.push(errorText(error));
    }
  };

  const processItem = async (
    { showId, poster }: { showId: string; poster: string },
    fetchTimeoutMs: number,
  ) => {
    const { source, thumbnail } = await createThumbnail(poster, {
      fetchTimeoutMs,
      deadline,
    });
    const sourceUrl = normalizePosterUrl(poster);
    const hash = createHash("sha1")
      .update(sourceUrl)
      .digest("hex")
      .slice(0, 16);
    // 포스터가 바뀌면 경로도 바뀌므로 1년 캐시를 걸어도 안전하다
    const path = `${showId}/${hash}.webp`;

    if (!dryRun) {
      await mustSucceed(
        storage.upload(path, thumbnail, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
        }),
        "썸네일 업로드",
      );

      await mustSucceed(
        admin.from("poster_thumbnails").upsert({
          show_id: showId,
          source_url: sourceUrl,
          path,
          width: THUMBNAIL_WIDTH,
          bytes: thumbnail.length,
          source_bytes: source.length,
          created_at: new Date().toISOString(),
        }),
        "썸네일 기록",
      );

      // 포스터가 A -> B -> A 로 돌아오면 A 경로를 다시 쓰므로 삭제 대기에서 뺀다
      await bookkeep(
        admin.from("poster_thumbnail_stale_files").delete().eq("path", path),
        `다시 쓰는 썸네일의 삭제 대기 해제(${path})`,
      );

      const previousPath = existing.get(showId)?.path;

      if (previousPath && previousPath !== path) {
        await bookkeep(
          admin
            .from("poster_thumbnail_stale_files")
            .upsert({ path: previousPath }, { ignoreDuplicates: true }),
          `예전 썸네일 보존 기록(${previousPath})`,
        );
      }

      if (failures.has(showId)) {
        await bookkeep(
          admin
            .from("poster_thumbnail_failures")
            .delete()
            .eq("show_id", showId),
          `실패 기록 삭제(${showId})`,
        );
      }
    }

    result.generated++;
    result.sourceBytes += source.length;
    result.thumbnailBytes += thumbnail.length;
  };

  const recordFailure = async (
    { showId, poster }: { showId: string; poster: string },
    error: unknown,
  ) => {
    result.failed.push({ showId, poster, error: errorText(error) });

    if (dryRun) return;

    const previous = failureOf({ showId, poster });

    await bookkeep(
      admin.from("poster_thumbnail_failures").upsert({
        show_id: showId,
        source_url: normalizePosterUrl(poster),
        attempts: (previous?.attempts ?? 0) + 1,
        last_error: errorText(error).slice(0, 500),
        last_attempt_at: new Date().toISOString(),
      }),
      `실패 기록 저장(${showId})`,
    );
  };

  let cursor = 0;

  const worker = async () => {
    while (cursor < pending.length) {
      const fetchTimeoutMs = Math.min(
        FETCH_TIMEOUT_MS,
        deadline - Date.now() - PROCESS_RESERVE_MS,
      );

      if (fetchTimeoutMs < MIN_FETCH_MS) break;

      const item = pending[cursor++];

      if (failureOf(item)) result.retried++;

      try {
        await processItem(item, fetchTimeoutMs);
      } catch (error) {
        await recordFailure(item, error);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  result.remaining = pending.length - cursor;

  return result;
}
