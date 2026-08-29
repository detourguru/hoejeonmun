import { getToday, normalizeDate, toKopisDate } from "@/lib/date";
import { discoverCastingFromKopis } from "@/service/casting-board-discovery";
import { getShows } from "@/service/show";

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
  }

  return Response.json({ checked: shows.length, results });
}
