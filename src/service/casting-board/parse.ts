import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
  ParsedDateTag,
  ParsedEvent,
  ParsedPerformance,
} from "@/type/casting";
import { ShowDetail } from "@/type/show";

import { dedupeEvents } from "./events";
import {
  normalizeCancelledEvents,
  normalizeCancelledSlots,
  normalizeCastingChanges,
  normalizeDateTags,
  normalizeEvents,
  normalizePerformances,
  slotKey,
} from "./normalize";
import {
  CASTING_OVERVIEW_BACKGROUND,
  CASTING_OVERVIEW_SEPARATOR,
  GEMINI_IMAGE_MAX_HEIGHT,
  GEMINI_IMAGE_MAX_WIDTH,
  GeminiImageBlock,
  ParseCastingBoardOptions,
  ParsedCastingBoardResult,
  PreparedCastingImage,
  VISION_MODEL,
  buildPrompt,
  castingJsonSchema,
  castingSchema,
  describeGeminiError,
} from "./prompt";

export async function resizeCastingImage(buffer: Buffer) {
  return sharp(buffer)
    .resize({
      width: GEMINI_IMAGE_MAX_WIDTH,
      height: GEMINI_IMAGE_MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export function shouldCreateCastingBoardOverview(images: PreparedCastingImage[]) {
  if (images.length < 2) return false;

  const widths = images.map(({ width }) => width).filter((width) => width > 0);
  const heights = images
    .map(({ height }) => height)
    .filter((height) => height > 0);

  if (widths.length !== images.length || heights.length !== images.length) {
    return false;
  }

  const maxWidth = Math.max(...widths);
  const minWidth = Math.min(...widths);

  if (maxWidth === 0 || minWidth / maxWidth < 0.85) return false;

  const tallImages = images.filter(
    ({ width, height }) => height / width >= 1.15,
  );

  return tallImages.length >= 2;
}

export async function createCastingBoardOverview(
  images: PreparedCastingImage[],
): Promise<GeminiImageBlock | null> {
  if (!shouldCreateCastingBoardOverview(images)) return null;

  const canvasWidth = Math.max(...images.map(({ width }) => width));
  const canvasHeight =
    images.reduce((sum, { height }) => sum + height, 0) +
    CASTING_OVERVIEW_SEPARATOR * (images.length - 1);
  const composites: sharp.OverlayOptions[] = [];
  let top = 0;

  for (const image of images) {
    composites.push({
      input: image.buffer,
      top,
      left: 0,
    });

    top += image.height + CASTING_OVERVIEW_SEPARATOR;
  }

  const overview = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: CASTING_OVERVIEW_BACKGROUND,
    },
  })
    .composite(composites)
    .jpeg({ quality: 80 })
    .toBuffer();

  const resized = await resizeCastingImage(overview);

  console.log(
    `[gemini] 연속 캡처 overview 추가 ${overview.byteLength}B -> ${resized.byteLength}B`,
  );

  return {
    type: "image",
    data: resized.toString("base64"),
    mime_type: "image/jpeg",
  };
}

export async function buildCastingImageBlocks(
  images: Blob[],
): Promise<GeminiImageBlock[]> {
  const prepared = await Promise.all(
    images.map(async (image, index) => {
      const buffer = Buffer.from(await image.arrayBuffer());
      const metadata = await sharp(buffer).metadata();

      return {
        index,
        buffer,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
      } satisfies PreparedCastingImage;
    }),
  );

  const baseBlocks = await Promise.all(
    prepared.map(async ({ buffer, index }) => {
      const resized = await resizeCastingImage(buffer);

      console.log(
        `[gemini] 이미지 ${index} 리사이즈 ${buffer.byteLength}B -> ${resized.byteLength}B`,
      );

      return {
        type: "image",
        data: resized.toString("base64"),
        mime_type: "image/jpeg",
      } satisfies GeminiImageBlock;
    }),
  );

  const overviewBlock = await createCastingBoardOverview(prepared);

  return overviewBlock ? [...baseBlocks, overviewBlock] : baseBlocks;
}

const CONSENSUS_RUNS = 3;
const CONSENSUS_THRESHOLD = 2;
const CONSENSUS_DEADLINE_MS = 48_000;

const serializeCastingValue = (actors: string[]) =>
  [...actors].sort().join("\u0000");

export function pickMostCommonValue<T>(
  values: T[],
  toKey: (value: T) => string = (value) => JSON.stringify(value),
) {
  const counts = new Map<string, { count: number; value: T }>();

  for (const value of values) {
    const key = toKey(value);
    const current = counts.get(key);

    if (current) current.count += 1;
    else counts.set(key, { count: 1, value });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
}

export function buildConsensusPerformances(
  runs: ParsedPerformance[][],
  threshold: number,
): ParsedPerformance[] {
  const bySlot = new Map<string, ParsedPerformance[]>();

  for (const run of runs) {
    for (const performance of run) {
      const key = slotKey(performance.date, performance.time);
      const current = bySlot.get(key) ?? [];

      current.push(performance);
      bySlot.set(key, current);
    }
  }

  const voted: ParsedPerformance[] = [];

  for (const performances of bySlot.values()) {
    const representative = performances[0];
    const roleNames = new Set(
      performances.flatMap(({ casting }) => Object.keys(casting)),
    );
    const casting: Record<string, string[]> = {};
    const unsureRoles: string[] = [];

    for (const role of roleNames) {
      const votes = performances
        .map((performance) => performance.casting[role])
        .filter((actors): actors is string[] => Array.isArray(actors));
      const best = pickMostCommonValue(votes, serializeCastingValue);

      if (best && best.count >= threshold) {
        casting[role] = [...best.value];
      } else {
        unsureRoles.push(role);
      }
    }

    const weekdayVote = pickMostCommonValue(
      performances
        .map(({ weekday }) => weekday.trim())
        .filter((weekday) => weekday.length > 0),
      (value) => value,
    );
    const imageIndexVote = pickMostCommonValue(
      performances.map(({ imageIndex }) => imageIndex),
      (value) => String(value),
    );
    const confidenceValues = performances.map(({ confidence }) => confidence);
    const confidence =
      confidenceValues.length > 0
        ? Math.max(...confidenceValues)
        : representative.confidence;
    const castMismatch = performances.some(
      (performance) => performance.castMismatch,
    );

    voted.push({
      date: representative.date,
      time: representative.time,
      weekday: weekdayVote?.value ?? representative.weekday,
      casting,
      imageIndex: imageIndexVote?.value ?? representative.imageIndex,
      confidence,
      castMismatch: castMismatch || undefined,
      unsureRoles: unsureRoles.length > 0 ? unsureRoles.sort() : undefined,
    });
  }

  return voted.sort((a, b) =>
    a.date === b.date
      ? a.time.localeCompare(b.time)
      : a.date.localeCompare(b.date),
  );
}

async function logConsensusStats({
  showId,
  runsRequested,
  runsSucceeded,
  performances,
}: {
  showId: string;
  runsRequested: number;
  runsSucceeded: number;
  performances: ParsedPerformance[];
}) {
  const performancesUnsureCount = performances.filter(
    ({ unsureRoles }) => (unsureRoles?.length ?? 0) > 0,
  ).length;
  const rolesUnsureCount = performances.reduce(
    (sum, { unsureRoles }) => sum + (unsureRoles?.length ?? 0),
    0,
  );
  const rolesCount = performances.reduce(
    (sum, { casting, unsureRoles }) =>
      sum + Object.keys(casting).length + (unsureRoles?.length ?? 0),
    0,
  );

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("casting_parse_consensus_logs")
      .insert({
        show_id: showId,
        runs_requested: runsRequested,
        runs_succeeded: runsSucceeded,
        performances_count: performances.length,
        performances_unsure_count: performancesUnsureCount,
        roles_count: rolesCount,
        roles_unsure_count: rolesUnsureCount,
      });

    if (error) throw error;
  } catch (error) {
    console.error("[gemini-consensus] 합의 통계 기록 실패", error);
  }
}

export async function parseCastingBoardWithConsensus(
  images: Blob[],
  show: ShowDetail,
  {
    model = VISION_MODEL,
    runs = CONSENSUS_RUNS,
    threshold = CONSENSUS_THRESHOLD,
    deadlineMs = CONSENSUS_DEADLINE_MS,
    budgetMs,
  }: ParseCastingBoardOptions & {
    runs?: number;
    threshold?: number;
    deadlineMs?: number;
  } = {},
): Promise<ParsedCastingBoardResult> {
  const startedAt = performance.now();

  const attempts = Array.from({ length: runs }, async (_, index) => {
    const remaining = Math.max(
      1,
      Math.round(deadlineMs - (performance.now() - startedAt)),
    );
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), remaining);

    try {
      const result = await parseCastingBoard(images, show, {
        model,
        budgetMs,
        abortSignal: abortController.signal,
      });

      console.log(
        `[gemini-consensus] run ${index + 1}/${runs} completed in ${Math.round(
          performance.now() - startedAt,
        )}ms`,
      );

      return result;
    } finally {
      clearTimeout(timeout);
    }
  });

  const settled = await Promise.allSettled(attempts);
  const successful = settled.flatMap((result, index) =>
    result.status === "fulfilled" ? [{ index, value: result.value }] : [],
  );

  if (successful.length === 0) {
    const firstError = settled.find((result) => result.status === "rejected");

    throw firstError?.status === "rejected"
      ? firstError.reason
      : new Error("Consensus parsing failed");
  }

  const base = successful[0].value;

  if (successful.length === 1) {
    await logConsensusStats({
      showId: show.mt20id,
      runsRequested: runs,
      runsSucceeded: successful.length,
      performances: base.performances,
    });

    return base;
  }

  const effectiveThreshold = Math.min(threshold, successful.length);
  const performances = buildConsensusPerformances(
    successful.map(({ value }) => value.performances),
    effectiveThreshold,
  );

  console.log(
    `[gemini-consensus] ${successful.length}/${runs} runs succeeded, threshold=${effectiveThreshold}, performances=${performances.length}`,
  );

  await logConsensusStats({
    showId: show.mt20id,
    runsRequested: runs,
    runsSucceeded: successful.length,
    performances,
  });

  return {
    ...base,
    performances,
  };
}

export async function parseCastingBoard(
  images: Blob[],
  show: ShowDetail,
  {
    model = VISION_MODEL,
    budgetMs,
    abortSignal,
  }: ParseCastingBoardOptions = {},
): Promise<ParsedCastingBoardResult> {
  const resizeStart = performance.now();

  const imageBlocks = await buildCastingImageBlocks(images);

  console.log(
    `[gemini] 리사이즈 전체 ${Math.round(performance.now() - resizeStart)}ms`,
  );

  const client = new GoogleGenAI({});

  const requestStart = performance.now();

  const GEMINI_BUDGET_MS = budgetMs ?? 55_000;
  const GEMINI_MIN_RETRY_MS = 10_000;
  const GEMINI_MAX_ATTEMPTS = 2;

  console.log(
    `[gemini] 요청 시작 (model=${model}, 이미지 ${imageBlocks.length}장)`,
  );

  let interaction: Awaited<
    ReturnType<typeof client.interactions.create>
  > | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    const remaining = Math.round(
      GEMINI_BUDGET_MS - (performance.now() - resizeStart),
    );

    if (attempt > 1 && remaining < GEMINI_MIN_RETRY_MS) {
      console.error(
        `[gemini] 남은 예산 ${remaining}ms이라 재시도를 건너뜁니다`,
      );
      break;
    }

    const attemptStart = performance.now();

    try {
      interaction = await client.interactions.create(
        {
          model,
          input: [{ type: "text", text: buildPrompt(show) }, ...imageBlocks],
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: castingJsonSchema,
          },
        },
        {
          timeout_ms: Math.max(remaining, GEMINI_MIN_RETRY_MS),
          fetchOptions: abortSignal ? { signal: abortSignal } : undefined,
          retries: { strategy: "none" },
        },
      );

      console.log(
        `[gemini] 시도 ${attempt}/${GEMINI_MAX_ATTEMPTS} 성공 ${Math.round(performance.now() - attemptStart)}ms`,
      );

      break;
    } catch (error) {
      lastError = error;

      console.error(
        `[gemini] 시도 ${attempt}/${GEMINI_MAX_ATTEMPTS} 실패 ${Math.round(performance.now() - attemptStart)}ms ${describeGeminiError(error)}`,
      );
    }
  }

  if (!interaction) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Gemini 요청이 실패했습니다");
  }

  const status = "status" in interaction ? interaction.status : "stream";
  const outputText =
    "output_text" in interaction ? interaction.output_text : undefined;
  const usage = "usage" in interaction ? interaction.usage : undefined;

  console.log(
    `[gemini] 응답 수신 ${Math.round(performance.now() - requestStart)}ms status=${status} output_text=${outputText?.length ?? 0}자 input_tokens=${usage?.total_input_tokens ?? "?"} output_tokens=${usage?.total_output_tokens ?? "?"}`,
  );

  if (!outputText) {
    throw new Error("Gemini가 응답하지 않았습니다");
  }

  const parseStart = performance.now();

  let raw: unknown;

  try {
    raw = JSON.parse(outputText);
  } catch {
    console.error(outputText);

    throw new Error("Gemini가 JSON이 아닌 응답을 반환했습니다");
  }

  const parsed = castingSchema.parse(raw) as {
    performances: ParsedPerformance[];
    dateTags: ParsedDateTag[];
    events: ParsedEvent[];
    cancelledSlots: ParsedCancelledSlot[];
    castingChanges: ParsedCastingChange[];
    cancelledEvents: ParsedCancelledEvent[];
    reason: string;
  };

  console.log(
    `[gemini] JSON 파싱+검증 ${Math.round(performance.now() - parseStart)}ms (회차 ${parsed.performances.length}건, 이벤트 ${parsed.events.length}건)`,
  );

  const normalizeStart = performance.now();

  const realImageCount = images.length;

  const { performances, skipped } = normalizePerformances(
    parsed.performances,
    show,
    realImageCount,
  );

  const result = {
    performances,
    skipped,
    dateTags: normalizeDateTags(
      parsed.dateTags,
      show,
      realImageCount,
      performances,
    ),
    events: await dedupeEvents(
      normalizeEvents(parsed.events, show, realImageCount),
    ),
    cancelledSlots: normalizeCancelledSlots(
      parsed.cancelledSlots,
      show,
      realImageCount,
    ),
    castingChanges: normalizeCastingChanges(
      parsed.castingChanges,
      show,
      realImageCount,
    ),
    cancelledEvents: normalizeCancelledEvents(
      parsed.cancelledEvents,
      show,
      realImageCount,
    ),
    reason: parsed.reason,
  };

  console.log(
    `[gemini] 정규화 ${Math.round(performance.now() - normalizeStart)}ms`,
  );

  return result;
}
