import { config } from "dotenv";

config({ path: ".env.local" });

import { discoverCastingFromKopis } from "@/service/casting-board-discovery";
import { getShows } from "@/service/show";

// Gemini 무료 쿼터 보호용 호출 간격
const DELAY_MS = 3000;

const SYSTEM_USER_ID = process.env.SYSTEM_UPLOAD_USER_ID;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!SYSTEM_USER_ID) {
    throw new Error(
      "SYSTEM_UPLOAD_USER_ID가 없습니다. scripts/seed-system-account.ts를 먼저 실행하세요.",
    );
  }

  const limit = Number(process.argv[2]) || Infinity;
  // 중간에 실패 시 이어서 할 위치
  const offset = Number(process.argv[3]) || 0;
  const shows = (await getShows()).filter((show) => show.prfstate === "공연중");
  const targets = shows.slice(offset, offset + limit);

  console.log(
    `오늘 공연중인 공연 ${shows.length}건 중 ${offset}번째부터 ${targets.length}건을 확인합니다.`,
  );

  const counts: Record<string, number> = {};

  for (const show of targets) {
    const label = `[${show.mt20id}] ${show.prfnm}`;
    const result = await discoverCastingFromKopis(show, SYSTEM_USER_ID);

    counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;

    switch (result.outcome) {
      case "saved":
        console.log(`${label} - 저장 완료 (회차 ${result.slotCount}건)`);
        break;
      case "duplicate":
        console.log(`${label} - 이미 등록된 이미지, 스킵`);
        break;
      case "not_casting":
        console.log(`${label} - 캐스팅표 아님`);
        break;
      case "stale":
        console.log(
          `${label} - 오늘 이후 회차 없음(개막 초반 캡처로 추정), 스킵`,
        );
        break;
      case "no_image":
        console.log(`${label} - 소개 이미지 없음, 스킵`);
        break;
      case "show_not_found":
        console.log(`${label} - 상세 조회 실패, 스킵`);
        break;
      case "failed":
        console.error(`${label} - 실패`, result.error);
        break;
    }

    await sleep(DELAY_MS);
  }

  console.log(
    `완료: 확인 ${targets.length} / ` +
      Object.entries(counts)
        .map(([outcome, count]) => `${outcome} ${count}`)
        .join(" / "),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
