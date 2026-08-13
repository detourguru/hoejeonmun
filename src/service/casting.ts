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
};

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

export async function getShowCastings(
  showId: string,
  start: string,
  end: string,
): Promise<CastingSlot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("slot_castings")
    .select("slot_id, date, time, role_name_raw, actor_name_raw, actor_id")
    .eq("show_id", showId)
    .gte("date", start)
    .lte("date", end)
    .order("date")
    .order("time")
    .order("role_name_raw");

  if (error) throw error;

  return groupBySlot(data as SlotCastingRow[]);
}

export function groupByDate<T extends { date: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    grouped.set(item.date, [...(grouped.get(item.date) ?? []), item]);
  }

  return grouped;
}
