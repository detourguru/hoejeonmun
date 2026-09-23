import { GoogleGenAI } from "@google/genai";

import { createAdminClient } from "@/lib/supabase/admin";
import { ExistingEvent, ParsedEvent, PendingEvent } from "@/type/casting";

import { toTitleKey, toExistingEvent, isExactSameEvent } from "./normalize";
import {
  MODEL,
  buildEventGroupPrompt,
  buildEventMatchPrompt,
  describeEvent,
  eventGroupJsonSchema,
  eventGroupSchema,
  eventMatchJsonSchema,
  eventMatchSchema,
} from "./prompt";

export async function suggestSameEvents(
  incoming: PendingEvent[],
  saved: ExistingEvent[],
) {
  const client = new GoogleGenAI({});

  const interaction = await client.interactions.create({
    model: MODEL,
    input: [
      {
        type: "text",
        text: buildEventMatchPrompt(
          incoming.map((event, index) => `${index}. ${describeEvent(event)}`),
          saved.map((event) => `#${event.id} ${describeEvent(event)}`),
        ),
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: eventMatchJsonSchema,
    },
  });

  if (!interaction.output_text) throw new Error("Gemini가 응답하지 않았습니다");

  const { matches } = eventMatchSchema.parse(
    JSON.parse(interaction.output_text),
  ) as { matches: { incomingIndex: number; savedId: number }[] };

  return new Map(
    matches.map(({ incomingIndex, savedId }) => [incomingIndex, savedId]),
  );
}

export async function attachSuggestedDuplicates(pending: PendingEvent[]) {
  const saved = [
    ...new Map(
      pending.flatMap(({ overlapping }) =>
        overlapping.map((event) => [event.id, event] as const),
      ),
    ).values(),
  ];

  if (saved.length === 0) return pending;

  let suggested: Map<number, number>;

  try {
    suggested = await suggestSameEvents(pending, saved);
  } catch (error) {
    console.error("이벤트 중복 판정 실패", error);

    return pending;
  }

  return pending.map((event, index) => {
    const savedId = suggested.get(index);
    const match = event.overlapping.find(({ id }) => id === savedId);

    if (!match) return event;

    return {
      ...event,
      suggestedSameAsGroupId: event.suggestedSameAsGroupId ?? match.groupId,
    };
  });
}

export async function attachOverlappingEvents(
  showId: string,
  pending: PendingEvent[],
): Promise<PendingEvent[]> {
  if (pending.length === 0) return pending;

  const from = pending.map(({ periodStart }) => periodStart).sort()[0];
  const to = pending
    .map(({ periodEnd }) => periodEnd)
    .sort()
    .at(-1)!;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("current_events")
    .select("id, title, period_start, group_id, period_end, source, edited")
    .eq("show_id", showId)
    .lte("period_start", to)
    .gte("period_end", from);

  if (error) throw error;

  const existing = data.map(toExistingEvent);

  return pending.map((event) => {
    const overlapping = existing.filter(
      ({ periodStart, periodEnd }) =>
        periodStart <= event.periodEnd && event.periodStart <= periodEnd,
    );

    if (overlapping.length === 0) return event;

    const exactMatch = overlapping.find((candidate) =>
      isExactSameEvent(event, candidate),
    );

    // 동일 이벤트를 다시 읽은 경우에는 확인을 요구하지 않고 기존 그룹을 재사용한다.
    if (exactMatch) {
      return {
        ...event,
        overlapping,
        suggestedSameAsGroupId:
          event.suggestedSameAsGroupId ?? exactMatch.groupId,
      };
    }

    return {
      ...event,
      overlapping,
      confirmReasons: [...event.confirmReasons, "overlaps_existing" as const],
    };
  });
}

// 첫공/막공처럼 특정 회차에만 적용되어야하는데 해당 날짜의 전체 회차에 적용되므로 사용자 확인을 받도록함
export async function attachAmbiguousBadgeFlags(
  showId: string,
  pending: PendingEvent[],
): Promise<PendingEvent[]> {
  const ambiguousCandidates = pending.filter(
    (event) =>
      event.source === "badge" &&
      event.periodStart === event.periodEnd &&
      !event.exactTimes?.length &&
      !event.listedSlots?.length,
  );

  if (ambiguousCandidates.length === 0) return pending;

  const admin = createAdminClient();

  const { data: slots, error } = await admin
    .from("slots")
    .select("date")
    .eq("show_id", showId)
    .in("date", [
      ...new Set(ambiguousCandidates.map(({ periodStart }) => periodStart)),
    ])
    .is("cancelled_at", null);

  if (error) throw error;

  const countByDate = new Map<string, number>();

  for (const { date } of slots) {
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }

  return pending.map((event) => {
    if (!ambiguousCandidates.includes(event)) return event;
    if ((countByDate.get(event.periodStart) ?? 0) <= 1) return event;

    return {
      ...event,
      confirmReasons: [
        ...event.confirmReasons,
        "ambiguous_badge_time" as const,
      ],
    };
  });
}

export async function groupSameEvents(
  events: ParsedEvent[],
): Promise<number[][]> {
  const client = new GoogleGenAI({});

  const interaction = await client.interactions.create({
    model: MODEL,
    input: [
      {
        type: "text",
        text: buildEventGroupPrompt(
          events.map((event, index) => `${index}. ${describeEvent(event)}`),
        ),
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: eventGroupJsonSchema,
    },
  });

  if (!interaction.output_text) throw new Error("Gemini가 응답하지 않았습니다");

  const { groups } = eventGroupSchema.parse(
    JSON.parse(interaction.output_text),
  ) as { groups: number[][] };

  return groups;
}

// 같은 업로드에서 여러 이미지가 같은 이벤트를 중복으로 담고 있을 때(예: 겹치게 캡처한 캘린더, 캘린더+추가 공지) 하나로 합친다
export async function dedupeEvents(
  events: ParsedEvent[],
): Promise<ParsedEvent[]> {
  const exact = new Map<string, ParsedEvent>();

  for (const event of events) {
    const key = `${toTitleKey(event.title)}|${event.periodStart}|${event.periodEnd}`;

    if (!exact.has(key)) exact.set(key, event);
  }

  const deduped = [...exact.values()];

  if (deduped.length < 2) return deduped;

  let groups: number[][];

  try {
    groups = await groupSameEvents(deduped);
  } catch (error) {
    console.error("이벤트 자체 중복 판정 실패", error);

    return deduped;
  }

  // 그룹마다 첫 번째 인덱스만 남기고 나머지는 중복으로 버린다
  const dropIndexes = new Set(groups.flatMap(([, ...rest]) => rest));

  return deduped.filter((_, index) => !dropIndexes.has(index));
}
