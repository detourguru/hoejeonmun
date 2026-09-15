import { parseArgs } from "node:util";

import { config } from "dotenv";

config({ path: ".env.local" });

import {
  cleanupStaleThumbnails,
  generatePosterThumbnails,
  getPosterThumbnailTargets,
} from "@/service/poster-thumbnail-generator";

const HELP = `목록용 포스터 썸네일을 만든다. 이미 만든 공연은 건너뛴다.

npm run thumbnails -- [개수] [--dry-run] [--budget=초]

  개수          앞에서부터 이만큼만 처리
  --dry-run     변환만 하고 업로드·기록은 하지 않음
  --budget=초   이 시간 안에 끝냄 (크론 마감 동작 확인용)`;

function parseOptions() {
  const { values, positionals } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      budget: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  const limit = positionals[0] ? Number(positionals[0]) : Infinity;
  const budgetSeconds = values.budget ? Number(values.budget) : null;

  if (
    values.help ||
    !(limit > 0) ||
    (budgetSeconds !== null && !(budgetSeconds > 0))
  ) {
    return null;
  }

  return { dryRun: values["dry-run"], limit, budgetSeconds };
}

const kb = (bytes: number) => `${Math.round(bytes / 1024).toLocaleString()}KB`;

async function main() {
  let options;

  try {
    options = parseOptions();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }

  if (!options) {
    console.log(HELP);
    return;
  }

  const { dryRun, limit, budgetSeconds } = options;

  const startedAt = Date.now();
  const deadline = budgetSeconds ? startedAt + budgetSeconds * 1000 : Infinity;

  const targets = (await getPosterThumbnailTargets(deadline)).slice(0, limit);

  console.log(
    `${dryRun ? "[미리보기] " : ""}대상 공연 ${targets.length}건의 썸네일을 확인합니다.` +
      (budgetSeconds ? ` 제한 ${budgetSeconds}초` : ""),
  );

  if (!dryRun) {
    const cleaned = await cleanupStaleThumbnails(deadline);

    if (cleaned > 0)
      console.log(`보존 기간이 지난 예전 썸네일 ${cleaned}개 삭제`);
  }

  const result = await generatePosterThumbnails(targets, {
    dryRun,
    deadline,
    concurrency: budgetSeconds ? 4 : 6,
  });
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(
    `완료(${seconds}초): 전체 ${result.total}건, 이미 있음 ${result.alreadyDone}건, ` +
      `${dryRun ? "변환" : "생성"} ${result.generated}건, 실패 ${result.failed.length}건, ` +
      `재시도 ${result.retried}건, 시간 부족으로 남김 ${result.remaining}건`,
  );

  if (result.generated > 0) {
    console.log(
      `원본 합계 ${kb(result.sourceBytes)} -> 썸네일 합계 ${kb(result.thumbnailBytes)} ` +
        `(평균 ${kb(result.sourceBytes / result.generated)} -> ${kb(result.thumbnailBytes / result.generated)})`,
    );
  }

  for (const { showId, poster, error } of result.failed) {
    console.error(`  실패 ${showId}: ${error} (${poster})`);
  }

  for (const error of result.bookkeepingErrors) {
    console.error(`  부가 기록 실패: ${error}`);
  }
}

// 남은 연결이 있어도 작업이 끝나면 바로 종료한다
main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
