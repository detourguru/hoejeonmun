import { config } from "dotenv";

config({ path: ".env.local" });

import { syncVenuesFromKopis } from "@/service/venue";

async function main() {
  const limit = Number(process.argv[2]) || Infinity;
  // 중간에 실패하거나 쿼터에 걸렸을 때 이어서 할 위치
  const offset = Number(process.argv[3]) || 0;

  console.log(
    `공연시설 동기화 시작 (offset=${offset}, limit=${
      limit === Infinity ? "전체" : limit
    })`,
  );

  const result = await syncVenuesFromKopis({ offset, limit });

  console.log(
    `완료: 전체 ${result.totalFacilities}건 중 ${result.processed}건 처리, ` +
      `관 ${result.syncedHalls}건 동기화`,
  );

  if (result.failed.length > 0) {
    console.error(`실패 ${result.failed.length}건:`);
    result.failed.forEach(({ mt10id, error }) =>
      console.error(`  ${mt10id}: ${error}`),
    );
  }

  const nextOffset = offset + result.processed;

  if (nextOffset < result.totalFacilities) {
    console.log(
      `이어하려면: npx tsx scripts/sync-venues-from-kopis.ts ` +
        `${limit === Infinity ? "" : limit} ${nextOffset}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
