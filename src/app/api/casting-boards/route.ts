import { revalidateTag } from "next/cache";
import * as z from "zod";

import { fail } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { ACTORS_CACHE_TAG } from "@/service/actor";
import {
  attachOverlappingEvents,
  saveCastingBoard,
  unverifiedPoints,
} from "@/service/casting-board";
import { CASTING_FEED_CACHE_TAG, showCastTag } from "@/service/casting";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const performanceSchema = z.object({
  date: z.string(),
  weekday: z.string(),
  time: z.string(),
  casting: z.record(z.string(), z.string()),
  imageIndex: z.number(),
});

const eventSourceSchema = z.enum(["badge", "notice"]);

const existingEventSchema = z.object({
  id: z.number(),
  title: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  source: eventSourceSchema,
  edited: z.boolean(),
});

const eventSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().optional(),
    periodStart: z.string().regex(ISO_DATE),
    periodEnd: z.string().regex(ISO_DATE),
    printedStartWeekday: z.string(),
    printedEndWeekday: z.string(),
    source: eventSourceSchema,
    imageIndex: z.number(),
    confirmReasons: z.array(
      z.enum(["range_badge", "no_printed_weekday", "overlaps_existing"]),
    ),
    overlapping: z.array(existingEventSchema),
    suggestedSameAsId: z.number().optional(),
    confirmed: z.boolean(),
    edited: z.boolean(),
    replacesEventId: z.number().optional(),
  })
  .refine(({ periodStart, periodEnd }) => periodStart <= periodEnd, {
    message: "이벤트 시작일이 종료일보다 늦어요.",
  });

const bodySchema = z
  .object({
    showId: z.string().min(1),
    storagePaths: z.array(z.string().min(1)).min(1),
    performances: z.array(performanceSchema),
    events: z.array(eventSchema),
    skippedCount: z.number(),
  })
  .refine(
    ({ performances, events }) => performances.length > 0 || events.length > 0,
    { message: "저장할 캐스팅이나 이벤트가 없어요." },
  );

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return fail(401, "로그인이 필요해요.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));

  if (!body.success) return fail(400, "잘못된 요청이에요.");

  const { showId, storagePaths, performances, events, skippedCount } =
    body.data;

  if (!storagePaths.every((path) => path.startsWith(`${userId}/`))) {
    return fail(403, "잘못된 요청이에요.");
  }

  try {
    const checked = await attachOverlappingEvents(
      showId,
      events.map((event) => ({
        ...event,
        confirmReasons: unverifiedPoints(event),
        overlapping: [],
      })),
    );

    const result = await saveCastingBoard({
      showId,
      userId,
      storagePaths,
      performances,
      events: events
        .map((event, index) => ({ ...event, ...checked[index] }))
        .filter(
          ({ confirmReasons, confirmed }) =>
            confirmReasons.length === 0 || confirmed,
        ),
      skippedCount,
    });

    revalidateTag(CASTING_FEED_CACHE_TAG, { expire: 0 });
    revalidateTag(showCastTag(showId), { expire: 0 });
    revalidateTag(ACTORS_CACHE_TAG, { expire: 0 });

    return Response.json(result);
  } catch (error) {
    console.error(error);

    return fail(500, "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
