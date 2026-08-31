import { revalidateTag } from "next/cache";
import * as z from "zod";

import { fail } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { ACTORS_CACHE_TAG } from "@/service/actor";
import { CASTING_FEED_CACHE_TAG, showCastTag } from "@/service/casting";
import {
  attachOverlappingEvents,
  saveCastingBoard,
  unverifiedPoints,
} from "@/service/casting-board";
import { MAX_IMAGE_COUNT } from "@/type/casting";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const performanceSchema = z.object({
  date: z.string(),
  weekday: z.string(),
  time: z.string(),
  casting: z.record(z.string(), z.array(z.string().min(1)).min(1)),
  imageIndex: z.number(),
  confidence: z.number(),
});

const cancelledSlotSchema = z.object({
  date: z.string().regex(ISO_DATE),
  time: z.string(),
  imageIndex: z.number(),
});

const castingChangeSchema = z.object({
  date: z.string().regex(ISO_DATE),
  time: z.string(),
  role: z.string().min(1),
  actor: z.string().min(1),
  imageIndex: z.number(),
});

const cancelledEventSchema = z.object({
  title: z.string().min(1),
  periodStart: z.string().regex(ISO_DATE),
  periodEnd: z.string().regex(ISO_DATE),
  imageIndex: z.number(),
});

const skippedPerformanceSchema = z.object({
  imageIndex: z.number(),
  raw: performanceSchema,
  reason: z.enum([
    "invalid_date",
    "invalid_time",
    "out_of_range",
    "weekday_mismatch",
    "empty_casting",
    "duplicate",
    "invalid_image_index",
  ]),
});

const eventSourceSchema = z.enum(["badge", "notice"]);

const existingEventSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  title: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  source: eventSourceSchema,
  edited: z.boolean(),
});

const slotExceptionSchema = z.object({
  date: z.string().regex(ISO_DATE),
  time: z.string(),
});

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

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
    includedSlots: z.array(slotExceptionSchema).optional(),
    excludedSlots: z.array(slotExceptionSchema).optional(),
    exactTimes: z.array(z.string().regex(TIME_REGEX)).optional(),
    listedSlots: z.array(slotExceptionSchema).optional(),
    periodStartCutoffTime: z.string().regex(TIME_REGEX).optional(),
    periodEndCutoffTime: z.string().regex(TIME_REGEX).optional(),
    confirmReasons: z.array(
      z.enum([
        "range_badge",
        "no_printed_weekday",
        "overlaps_existing",
        "has_slot_exceptions",
        "has_specific_times",
      ]),
    ),
    overlapping: z.array(existingEventSchema),
    suggestedSameAsId: z.number().optional(),
    confirmed: z.boolean(),
    edited: z.boolean(),
    replacesGroupId: z.number().optional(),
  })
  .refine(({ periodStart, periodEnd }) => periodStart <= periodEnd, {
    message: "이벤트 시작일이 종료일보다 늦어요.",
  });

const bodySchema = z
  .object({
    showId: z.string().min(1),
    storagePaths: z.array(z.string().min(1)).min(1).max(MAX_IMAGE_COUNT),
    performances: z.array(performanceSchema),
    events: z.array(eventSchema),
    skipped: z.array(skippedPerformanceSchema),
    cancelledSlots: z.array(cancelledSlotSchema).default([]),
    castingChanges: z.array(castingChangeSchema).default([]),
    cancelledEvents: z.array(cancelledEventSchema).default([]),
  })
  .refine(
    ({ performances, events, cancelledSlots, castingChanges, cancelledEvents }) =>
      performances.length > 0 ||
      events.length > 0 ||
      cancelledSlots.length > 0 ||
      castingChanges.length > 0 ||
      cancelledEvents.length > 0,
    { message: "저장할 캐스팅이나 이벤트가 없어요." },
  );

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return fail(401, "로그인이 필요해요.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));

  if (!body.success) return fail(400, "잘못된 요청이에요.");

  const {
    showId,
    storagePaths,
    performances,
    events,
    skipped,
    cancelledSlots,
    castingChanges,
    cancelledEvents,
  } = body.data;

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
      skipped,
      cancelledSlots,
      castingChanges,
      cancelledEvents,
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
