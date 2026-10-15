import { isCronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  purgeExpiredParseFailureImages,
  purgeExpiredParseResults,
} from "@/service/casting-board";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const result = await purgeExpiredParseFailureImages(admin);
  const expiredParseResults = await purgeExpiredParseResults(admin);

  return Response.json({ ...result, expiredParseResults });
}
