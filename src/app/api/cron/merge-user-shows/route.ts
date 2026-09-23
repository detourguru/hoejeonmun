import { revalidateTag } from "next/cache";

import { CASTING_FEED_CACHE_TAG } from "@/service/casting";
import { SHOWS_CACHE_TAG } from "@/service/show";
import { mergeUserShowsWithKopis } from "@/service/user-show-merge";

export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");

  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await mergeUserShowsWithKopis();

  if (result.merged.length > 0) {
    revalidateTag(SHOWS_CACHE_TAG, { expire: 0 });
    revalidateTag(CASTING_FEED_CACHE_TAG, { expire: 0 });
  }

  return Response.json(result);
}
