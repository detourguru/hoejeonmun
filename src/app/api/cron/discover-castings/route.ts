import { revalidateTag } from "next/cache";

import { addDays, getToday, normalizeDate, toKopisDate } from "@/lib/date";
import { CASTING_FEED_CACHE_TAG, showCastTag } from "@/service/casting";
import { discoverCastingFromKopis } from "@/service/casting-board-discovery";
import { getShows } from "@/service/show";
import { syncVenuesFromKopis } from "@/service/venue";

export const maxDuration = 60;

// 오늘 날짜부로 개막한 공연 & 오늘 이후 회차 여부를 확인한다
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");

  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const systemUserId = process.env.SYSTEM_UPLOAD_USER_ID;

  if (!systemUserId) {
    return Response.json(
      { error: "SYSTEM_UPLOAD_USER_ID가 설정되지 않았어요." },
      { status: 500 },
    );
  }

  const today = toKopisDate(getToday());
  const shows = (await getShows()).filter(
    (show) => normalizeDate(show.prfpdfrom, "") === today,
  );

  const results = [];

  for (const show of shows) {
    results.push(await discoverCastingFromKopis(show, systemUserId));
    revalidateTag(showCastTag(show.mt20id), { expire: 0 });
  }

  if (shows.length > 0) revalidateTag(CASTING_FEED_CACHE_TAG, { expire: 0 });

  // 대학로/대극장 필터용 공연장 좌석수 미러링
  const yesterday = toKopisDate(addDays(getToday(), -1));
  const venueSync = await syncVenuesFromKopis({ afterdate: yesterday });

  return Response.json({ checked: shows.length, results, venueSync });
}
