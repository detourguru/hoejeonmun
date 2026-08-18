import { createClient } from "@/lib/supabase/server";

export type CastingRole = {
  role: string;
  actor: string;
  actorId: number | null;
};

export type CastingSlot = {
  id: number;
  // YYYY-MM-DD
  date: string;
  // HH:mm
  time: string;
  casting: CastingRole[];
};

type SlotCastingRow = {
  slot_id: number;
  date: string;
  time: string;
  role_name_raw: string;
  actor_name_raw: string;
  actor_id: number | null;
  assignment_id: number;
};

// 원본 표의 앞 두 열을 주연 페어로 본다
export const LEAD_COUNT = 2;

export const getPairKey = (actors: string[]) =>
  actors.slice(0, LEAD_COUNT).join("·");

export const getSlotPairKey = (slot: CastingSlot) =>
  getPairKey(slot.casting.map(({ actor }) => actor));

function groupBySlot(rows: SlotCastingRow[]): CastingSlot[] {
  const slots = new Map<number, CastingSlot>();

  for (const row of rows) {
    const slot = slots.get(row.slot_id) ?? {
      id: row.slot_id,
      date: row.date,
      time: row.time.slice(0, 5),
      casting: [],
    };

    slot.casting.push({
      role: row.role_name_raw,
      actor: row.actor_name_raw,
      actorId: row.actor_id,
    });

    slots.set(row.slot_id, slot);
  }

  return [...slots.values()];
}

// getShowCastings는 보고 있는 달만 조회
export async function getShowCastings(
  showId: string,
  start: string,
  end: string,
): Promise<CastingSlot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("slot_castings")
    .select(
      "slot_id, date, time, role_name_raw, actor_name_raw, actor_id, assignment_id",
    )
    .eq("show_id", showId)
    .gte("date", start)
    .lte("date", end)
    .order("date")
    .order("time")
    // 캐스팅보드 헤더 순서대로 넣었으므로 id 순 == 원본 표의 배역 순서
    .order("assignment_id");

  if (error) throw error;

  return groupBySlot(data as SlotCastingRow[]);
}

export async function getShowFilterData(showId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("slot_castings")
    .select("actor_name_raw")
    .eq("show_id", showId);

  if (error) throw error;

  const rows = data as Pick<SlotCastingRow, "actor_name_raw">[];

  return {
    actors: [...new Set(rows.map(({ actor_name_raw }) => actor_name_raw))],
  };
}

export type ShowEvent = {
  id: number;
  title: string;
  description: string | null;
  // 이벤트를 확인할 수 있는 외부 링크 (선택)
  url: string | null;
  // YYYY-MM-DD
  periodStart: string;
  periodEnd: string;
  slotId: number | null;
  edited: boolean;
};

type EventRow = {
  id: number;
  title: string;
  description: string | null;
  url: string | null;
  period_start: string;
  period_end: string;
  slot_id: number | null;
  edited: boolean;
};

// getShowEvents는 보고 있는 달과 기간이 겹치는 이벤트만 조회
export async function getShowEvents(
  showId: string,
  start: string,
  end: string,
): Promise<ShowEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visible_events")
    .select(
      "id, title, description, url, period_start, period_end, slot_id, edited",
    )
    .eq("show_id", showId)
    .lte("period_start", end)
    .gte("period_end", start)
    .order("period_start");

  if (error) throw error;

  return (data as EventRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    url: row.url,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    slotId: row.slot_id,
    edited: row.edited,
  }));
}

export function groupByDate<T extends { date: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    grouped.set(item.date, [...(grouped.get(item.date) ?? []), item]);
  }

  return grouped;
}
