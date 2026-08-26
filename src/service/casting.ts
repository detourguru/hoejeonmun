import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CASTING_BOARD_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/type/casting";

const REVALIDATE = 60 * 5;

export const CASTING_FEED_CACHE_TAG = "casting-feed";
export const showCastTag = (showId: string) => `show-cast:${showId}`;

export type CastingRole = {
  role: string;
  actor: string;
  actorId: number | null;
};

export type CastingSlot = {
  id: number;
  uploadId: number;
  // YYYY-MM-DD
  date: string;
  // HH:mm
  time: string;
  casting: CastingRole[];
};

type SlotCastingRow = {
  slot_id: number;
  upload_id: number;
  date: string;
  time: string;
  role_name_raw: string;
  actor_name_raw: string;
  actor_id: number | null;
  assignment_id: number;
};

type UploadImageRow = {
  id: number;
  upload_id: number;
  storage_path: string;
  position: number;
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
      uploadId: row.upload_id,
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
      "slot_id, date, upload_id, time, role_name_raw, actor_name_raw, actor_id, assignment_id",
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
  return unstable_cache(
    async (id: string) => {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from("slot_castings")
        .select("actor_name_raw")
        .eq("show_id", id);

      if (error) throw error;

      const rows = data as Pick<SlotCastingRow, "actor_name_raw">[];

      return {
        actors: [...new Set(rows.map(({ actor_name_raw }) => actor_name_raw))],
      };
    },
    ["show-filter-data"],
    { tags: [showCastTag(showId)], revalidate: REVALIDATE },
  )(showId);
}

export type ShowEvent = {
  id: number;
  title: string;
  description: string | null;
  // YYYY-MM-DD
  periodStart: string;
  periodEnd: string;
  slotIds: number[];
  uploadImageId: number;
  edited: boolean;
};

type EventRow = {
  id: number;
  title: string;
  description: string | null;
  period_start: string;
  period_end: string;
  upload_image_id: number;
  edited: boolean;
};

// 이벤트 id -> 적용되는 회차 id 목록
async function getSlotIdsByEvent(
  supabase: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
  eventIds: number[],
): Promise<Map<number, number[]>> {
  if (eventIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("event_slots")
    .select("event_id, slot_id")
    .in("event_id", eventIds);

  if (error) throw error;

  const rows = data as { event_id: number; slot_id: number }[];
  const slotIdsByEvent = new Map<number, number[]>();

  for (const { event_id, slot_id } of rows) {
    slotIdsByEvent.set(event_id, [
      ...(slotIdsByEvent.get(event_id) ?? []),
      slot_id,
    ]);
  }

  return slotIdsByEvent;
}

// getShowEvents는 보고 있는 달과 기간이 겹치는 이벤트만 조회
export async function getShowEvents(
  showId: string,
  start: string,
  end: string,
): Promise<ShowEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("current_events")
    .select(
      "id, title, description, period_start, period_end, upload_image_id, edited",
    )
    .eq("show_id", showId)
    .lte("period_start", end)
    .gte("period_end", start)
    .order("period_start");

  if (error) throw error;

  const rows = data as EventRow[];
  const slotIdsByEvent = await getSlotIdsByEvent(
    supabase,
    rows.map(({ id }) => id),
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    slotIds: slotIdsByEvent.get(row.id) ?? [],
    uploadImageId: row.upload_image_id,
    edited: row.edited,
  }));
}

export type EventWithReportStatus = ShowEvent & {
  reported: boolean;
  imageUrl: string | null;
};

export type RecentUploadedShow = {
  showId: string;
  uploadedAt: string;
};

const RECENT_UPLOADS_FETCH_LIMIT = 100;

// 최근 캐스팅보드가 올라온 공연
export async function getRecentUploadedShows(
  limit: number,
): Promise<RecentUploadedShow[]> {
  const data = await unstable_cache(
    async () => {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from("uploads")
        .select("show_id, created_at")
        .order("created_at", { ascending: false })
        .limit(RECENT_UPLOADS_FETCH_LIMIT);

      if (error) throw error;

      return data as { show_id: string; created_at: string }[];
    },
    ["recent-uploaded-shows"],
    { tags: [CASTING_FEED_CACHE_TAG], revalidate: REVALIDATE },
  )();

  const seen = new Set<string>();
  const recent: RecentUploadedShow[] = [];

  for (const row of data) {
    if (seen.has(row.show_id)) continue;

    seen.add(row.show_id);
    recent.push({ showId: row.show_id, uploadedAt: row.created_at });

    if (recent.length >= limit) break;
  }

  return recent;
}

export type RecentEvent = ShowEvent & {
  showId: string;
  createdAt: string;
};

type RecentEventRow = EventRow & { show_id: string; created_at: string };

export async function getRecentEvents(limit: number): Promise<RecentEvent[]> {
  const data = await unstable_cache(
    async (limit: number) => {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from("current_events")
        .select(
          "id, show_id, title, description, period_start, period_end, upload_image_id, edited, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const rows = data as RecentEventRow[];
      const slotIdsByEvent = await getSlotIdsByEvent(
        supabase,
        rows.map(({ id }) => id),
      );

      return rows.map((row) => ({
        ...row,
        slotIds: slotIdsByEvent.get(row.id) ?? [],
      }));
    },
    ["recent-events"],
    { tags: [CASTING_FEED_CACHE_TAG], revalidate: REVALIDATE },
  )(limit);

  return data.map((row) => ({
    id: row.id,
    showId: row.show_id,
    title: row.title,
    description: row.description,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    slotIds: row.slotIds,
    uploadImageId: row.upload_image_id,
    edited: row.edited,
    createdAt: row.created_at,
  }));
}

export function groupByDate<T extends { date: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    grouped.set(item.date, [...(grouped.get(item.date) ?? []), item]);
  }

  return grouped;
}

async function getSignedUrlsByPath(paths: string[]) {
  const uniquePaths = [...new Set(paths)];

  if (uniquePaths.length === 0) return new Map<string, string>();

  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(CASTING_BOARD_BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);

  if (error) throw error;

  const signedByPath = new Map<string, string>();

  for (const [index, { path, signedUrl }] of data.entries()) {
    const requestedPath = path || uniquePaths[index];

    if (requestedPath && signedUrl) {
      signedByPath.set(requestedPath, signedUrl);
    }
  }

  return signedByPath;
}

async function signPaths(paths: string[]): Promise<string[]> {
  const signedByPath = await getSignedUrlsByPath(paths);

  return paths.flatMap((path) => signedByPath.get(path) ?? []);
}

export async function getEventsWithReportStatus(
  events: ShowEvent[],
): Promise<EventWithReportStatus[]> {
  if (events.length === 0) return [];

  const supabase = await createClient();
  const admin = createAdminClient();
  const eventIds = [...new Set(events.map(({ id }) => id))];
  const uploadImageIds = [
    ...new Set(events.map(({ uploadImageId }) => uploadImageId)),
  ];

  const [{ data: reports }, { data: images, error: imagesError }] =
    await Promise.all([
      supabase.from("event_reports").select("event_id").in("event_id", eventIds),
      admin
        .from("upload_images")
        .select("id, storage_path")
        .in("id", uploadImageIds),
    ]);

  if (imagesError) throw imagesError;

  const reportedEventIds = new Set(
    (reports ?? []).map(({ event_id }) => event_id),
  );
  const imageRows = images as Pick<UploadImageRow, "id" | "storage_path">[];
  const signedByPath = await getSignedUrlsByPath(
    imageRows.map(({ storage_path }) => storage_path),
  );
  const imageUrlById = new Map(
    imageRows.map(({ id, storage_path }) => [
      id,
      signedByPath.get(storage_path) ?? null,
    ]),
  );

  return events.map((event) => ({
    ...event,
    reported: reportedEventIds.has(event.id),
    imageUrl: imageUrlById.get(event.uploadImageId) ?? null,
  }));
}

export async function getUploadImages(
  uploadId: number | null,
): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("upload_images")
    .select("storage_path")
    .eq("upload_id", uploadId)
    .order("position");

  if (error) throw error;

  const rows = data as Pick<UploadImageRow, "storage_path">[];

  return signPaths(rows.map(({ storage_path }) => storage_path));
}

export async function isReported(uploadId: number, slotId: number | null) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("vandal_reports")
    .select("slot_id")
    .eq("slot_id", slotId)
    .eq("upload_id", uploadId)
    .maybeSingle();

  return Boolean(data);
}
