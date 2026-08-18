import * as z from "zod";

import { fail } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { saveCastingBoard } from "@/service/casting-board";

const performanceSchema = z.object({
  date: z.string(),
  weekday: z.string(),
  time: z.string(),
  casting: z.record(z.string(), z.string()),
  imageIndex: z.number(),
});

const dateTagSchema = z.object({
  tag: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  printedStartWeekday: z.string(),
  printedEndWeekday: z.string(),
  imageIndex: z.number(),
});

const eventSchema = z.object({
  title: z.string(),
  rawTitle: z.string(),
  description: z.string().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  printedStartWeekday: z.string(),
  printedEndWeekday: z.string(),
  imageIndex: z.number(),
});

const bodySchema = z
  .object({
    showId: z.string().min(1),
    storagePaths: z.array(z.string().min(1)).min(1),
    performances: z.array(performanceSchema),
    dateTags: z.array(dateTagSchema),
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

  const { showId, storagePaths, performances, dateTags, events, skippedCount } =
    body.data;

  if (!storagePaths.every((path) => path.startsWith(`${userId}/`))) {
    return fail(403, "잘못된 요청이에요.");
  }

  try {
    const result = await saveCastingBoard({
      showId,
      userId,
      storagePaths,
      performances,
      dateTags,
      events,
      skippedCount,
    });

    return Response.json(result);
  } catch (error) {
    console.error(error);

    return fail(500, "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
