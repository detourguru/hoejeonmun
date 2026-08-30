import { createAdminClient } from "@/lib/supabase/admin";
import { purgeExpiredParseFailureImages } from "@/service/casting-board";

export const maxDuration = 60;

// 보존 기간이 지난 파싱 실패 원본 이미지를 정리한다
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");

  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const result = await purgeExpiredParseFailureImages(admin);

  return Response.json(result);
}
