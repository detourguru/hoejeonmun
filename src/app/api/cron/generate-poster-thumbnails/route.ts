import {
  cleanupStaleThumbnails,
  generatePosterThumbnails,
  getPosterThumbnailTargets,
  withTimeout,
} from "@/service/poster-thumbnail-generator";

export const maxDuration = 60;

const TOTAL_BUDGET_MS = 50_000;
const TARGETS_BUDGET_MS = 20_000;
const CLEANUP_BUDGET_MS = 5_000;

// 새로 등록됐거나 포스터가 바뀐 공연의 목록용 썸네일을 만든다
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");

  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const startedAt = Date.now();
  const deadline = startedAt + TOTAL_BUDGET_MS;

  let targets;

  try {
    // DB 요청은 시간이 되면 취소된다
    targets = await withTimeout(
      getPosterThumbnailTargets(startedAt + TARGETS_BUDGET_MS),
      TARGETS_BUDGET_MS,
      "썸네일 대상 조회",
    );
  } catch (error) {
    console.error("포스터 썸네일 대상 조회 실패", error);

    return Response.json(
      { error: "썸네일 대상 조회에 실패했어요." },
      { status: 500 },
    );
  }

  const cleanedStaleFiles = await cleanupStaleThumbnails(
    Math.min(deadline, Date.now() + CLEANUP_BUDGET_MS),
  ).catch((error) => {
    console.error("예전 썸네일 정리 실패", error);

    return 0;
  });

  const result = await generatePosterThumbnails(targets, { deadline });

  if (result.failed.length > 0) {
    console.error("포스터 썸네일 생성 실패", result.failed);
  }

  if (result.bookkeepingErrors.length > 0) {
    console.error("포스터 썸네일 부가 기록 실패", result.bookkeepingErrors);
  }

  return Response.json({
    ...result,
    cleanedStaleFiles,
    elapsedMs: Date.now() - startedAt,
  });
}
