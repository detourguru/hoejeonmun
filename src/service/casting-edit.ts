import "server-only";

import { toShortDate } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/admin";

type CastingEditAction =
  | "cancel_slot"
  | "cancel_event"
  | "change_actor"
  | "update_casting"
  | "add_casting"
  | "delete_casting"
  | "move_slot"
  | "update_variant"
  | "update_event";

type Json = Record<string, unknown>;

type EditFields = {
  action: CastingEditAction;
  target: Json;
  before: Json | Json[] | null;
  after: Json | null;
};

type CastingEditRow = EditFields & {
  id: number;
  source: "notice" | "correction";
  created_at: string;
  reverted_at: string | null;
};

export type CastingEditItem = {
  id: number;
  source: "notice" | "correction";
  createdAt: string;
  reverted: boolean;
  label: string;
  detail: string;
};

type Lookup = {
  slotLabel: (id: number) => string;
  eventTitle: (id: number) => string;
};

const ACTION_LABEL: Record<CastingEditAction, string> = {
  cancel_slot: "회차 취소",
  cancel_event: "이벤트 취소",
  change_actor: "캐스팅 변경",
  update_casting: "배역·배우 수정",
  add_casting: "배역 추가",
  delete_casting: "배역 삭제",
  move_slot: "회차 이동",
  update_variant: "회차 구분",
  update_event: "이벤트 수정",
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const asObject = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};

const asList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const describeSlots = (ids: unknown, { slotLabel }: Lookup) => {
  const labels = asList(ids).map((slotId) => slotLabel(Number(slotId)));

  return labels.length > 3
    ? `${labels[0]} 외 ${labels.length - 1}회차`
    : labels.join(", ");
};

const describePeriod = (value: Json) =>
  `${toShortDate(text(value.period_start))}~${toShortDate(text(value.period_end))}`;

export function describeCastingEdit(
  { action, target, before, after }: EditFields,
  lookup: Lookup,
): { label: string; detail: string } {
  const prev = asObject(before);
  const next = asObject(after);

  const detail = (() => {
    switch (action) {
      case "cancel_slot":
        return lookup.slotLabel(Number(target.slot_id));
      case "cancel_event":
        return lookup.eventTitle(Number(target.event_id));
      case "change_actor": {
        const previous = asObject(asList(before)[0]);

        return `${lookup.slotLabel(Number(target.slot_id))} ${text(target.role)}: ${text(previous.actor_name_raw)} → ${text(next.actor_name_raw)}`;
      }
      case "update_casting":
        return `${text(prev.role)} ${text(prev.actor_name_raw)} → ${text(next.role)} ${text(next.actor_name_raw)} (${describeSlots(target.slot_ids, lookup)})`;
      case "add_casting":
        return `${text(next.role)} ${text(next.actor_name_raw)} (${describeSlots(target.slot_ids, lookup)})`;
      case "delete_casting": {
        const row = asObject(asList(prev.rows)[0]);

        return `${text(row.role_name_raw)} ${text(row.actor_name_raw)} (${describeSlots(target.slot_ids, lookup)})`;
      }
      case "move_slot":
        return `${lookup.slotLabel(Number(prev.slot_id))} → ${lookup.slotLabel(Number(next.slot_id))}`;
      case "update_variant":
        return `${lookup.slotLabel(Number(target.slot_id))} ${text(prev.label) || "없음"} → ${text(next.label)}`;
      case "update_event":
        return `${text(prev.title)} ${describePeriod(prev)} → ${text(next.title)} ${describePeriod(next)}`;
    }
  })();

  return { label: ACTION_LABEL[action], detail };
}

const collectIds = (rows: CastingEditRow[]) => {
  const slotIds = new Set<number>();
  const eventIds = new Set<number>();

  for (const { target, before, after } of rows) {
    const prev = asObject(before);
    const next = asObject(after);

    for (const value of [
      target.slot_id,
      prev.slot_id,
      next.slot_id,
      ...asList(target.slot_ids),
    ]) {
      if (value !== undefined && value !== null) slotIds.add(Number(value));
    }

    if (target.event_id !== undefined) eventIds.add(Number(target.event_id));
  }

  return { slotIds: [...slotIds], eventIds: [...eventIds] };
};

export async function getCastingEdits(
  showId: string,
  limit = 100,
): Promise<CastingEditItem[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("casting_edits")
    .select(
      "id, source, action, target, before, after, created_at, reverted_at",
    )
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = data as CastingEditRow[];
  const { slotIds, eventIds } = collectIds(rows);

  const [slots, events] = await Promise.all([
    slotIds.length > 0
      ? admin.from("slots").select("id, date, time").in("id", slotIds)
      : { data: [], error: null },
    eventIds.length > 0
      ? admin.from("events").select("id, title").in("id", eventIds)
      : { data: [], error: null },
  ]);

  if (slots.error) throw slots.error;
  if (events.error) throw events.error;

  const slotLabelById = new Map(
    (slots.data as { id: number; date: string; time: string }[]).map(
      ({ id, date, time }) => [id, `${toShortDate(date)} ${time.slice(0, 5)}`],
    ),
  );
  const eventTitleById = new Map(
    (events.data as { id: number; title: string }[]).map(({ id, title }) => [
      id,
      title,
    ]),
  );

  const lookup: Lookup = {
    slotLabel: (id) => slotLabelById.get(id) ?? "삭제된 회차",
    eventTitle: (id) => eventTitleById.get(id) ?? "삭제된 이벤트",
  };

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    createdAt: row.created_at,
    reverted: row.reverted_at !== null,
    ...describeCastingEdit(row, lookup),
  }));
}
