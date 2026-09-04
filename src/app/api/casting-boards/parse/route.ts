import * as z from "zod";

import { errorMessage, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { DuplicateReason } from "@/service/casting-board";
import {
  attachAmbiguousBadgeFlags,
  attachOverlappingEvents,
  attachSuggestedDuplicates,
  findDuplicateReasons,
  hashImages,
  logParseFailure,
  parseCastingBoardWithConsensus,
  toPendingEvents,
} from "@/service/casting-board";
import { getShow } from "@/service/show";
import { CASTING_BOARD_BUCKET, MAX_IMAGE_COUNT } from "@/type/casting";

export const maxDuration = 60;

const bodySchema = z.object({
  showId: z.string().min(1),
  storagePaths: z.array(z.string().min(1)).min(1).max(MAX_IMAGE_COUNT),
});

function duplicateMessage(reasons: (DuplicateReason | null)[]) {
  if (reasons.includes("reported"))
    return "신고가 쌓여 내려간 이미지예요. 표시된 이미지를 제외하고 재시도해주세요.";

  if (reasons.includes("registered"))
    return "이미 등록된 이미지예요. 표시된 이미지를 제외하고 재시도해주세요.";

  return "같은 이미지를 두 번 선택했어요. 표시된 이미지를 제외하고 재시도해주세요.";
}

function createLap() {
  const id = Math.random().toString(36).slice(2, 8);
  const started = performance.now();
  let last = started;

  return (label: string) => {
    const now = performance.now();

    console.log(
      `[parse ${id}] ${label} ${Math.round(now - last)}ms (누적 ${Math.round(now - started)}ms)`,
    );

    last = now;
  };
}

export async function POST(request: Request) {
  const lap = createLap();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return fail(401, "로그인이 필요해요.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));

  if (!body.success) return fail(400, "잘못된 요청이에요.");

  const { showId, storagePaths } = body.data;

  if (!storagePaths.every((path) => path.startsWith(`${userId}/`))) {
    return fail(403, "잘못된 요청이에요.");
  }

  lap("인증과 요청 검증");

  const show = await getShow(showId);

  lap("공연 조회 (KOPIS)");

  if (!show) return fail(404, "공연을 찾을 수 없어요.");

  const admin = createAdminClient();

  const downloads = await Promise.all(
    storagePaths.map((path) =>
      admin.storage.from(CASTING_BOARD_BUCKET).download(path),
    ),
  );

  lap(`이미지 ${storagePaths.length}장 다운로드`);

  if (downloads.some(({ data: image, error }) => error || !image)) {
    return fail(404, "업로드된 이미지를 찾을 수 없어요.");
  }

  const images = downloads.map(({ data: image }) => image!);
  const hashes = await hashImages(images);

  lap("이미지 해시");

  const reasons = await findDuplicateReasons({ admin, showId, hashes });

  lap("중복 이미지 조회");
  const duplicateIndexes = reasons.flatMap((reason, index) =>
    reason ? [index] : [],
  );

  if (duplicateIndexes.length > 0) {
    return Response.json(
      {
        message: duplicateMessage(reasons),
        duplicateIndexes,
      },
      { status: 409 },
    );
  }

  try {
    const {
      performances,
      dateTags,
      events,
      cancelledSlots,
      castingChanges,
      cancelledEvents,
      skipped,
      reason,
    } = await parseCastingBoardWithConsensus(images, show);

    lap(
      `표 추출 (회차 ${performances.length}건, 이벤트 ${events.length}건, 취소 회차 ${cancelledSlots.length}건, 캐스팅 변경 ${castingChanges.length}건, 취소 이벤트 ${cancelledEvents.length}건)`,
    );

    if (
      performances.length === 0 &&
      events.length === 0 &&
      cancelledSlots.length === 0 &&
      castingChanges.length === 0 &&
      cancelledEvents.length === 0
    ) {
      await logParseFailure({
        admin,
        showId,
        userId,
        storagePaths,
        type: "no_table_found",
        reason,
      });

      return fail(
        422,
        reason
          ? `이미지에서 캐스팅 표나 이벤트 안내를 찾지 못했어요. (${reason})`
          : "이미지에서 캐스팅 표나 이벤트 안내를 찾지 못했어요.",
        { retained: true },
      );
    }

    const overlapping = await attachOverlappingEvents(
      showId,
      toPendingEvents(dateTags, events),
    );

    lap("겹치는 이벤트 조회");

    const flagged = await attachAmbiguousBadgeFlags(showId, overlapping);

    lap("모호한 배지 시간 조회");

    const pendingEvents = await attachSuggestedDuplicates(flagged);

    lap("이벤트 중복 판정");

    return Response.json({
      performances,
      events: pendingEvents,
      cancelledSlots,
      castingChanges,
      cancelledEvents,
      skipped,
    });
  } catch (error) {
    lap("예외로 중단");
    console.error(error);

    await logParseFailure({
      admin,
      showId,
      userId,
      storagePaths,
      type: "exception",
      reason: errorMessage(error),
    });

    return fail(
      500,
      "캐스팅보드를 분석하지 못했어요. 잠시 후 다시 시도해 주세요.",
      { retained: true },
    );
  }
}
