import { createClient } from "@/lib/supabase/server";
import {
  CalendarEvent,
  getEventsWithReportStatus,
  getSlotIdsByEvent,
  getUploadImages,
  ShowEvent,
} from "@/service/casting";
import { getShow } from "@/service/show";

async function getShowNames(showIds: string[]) {
  const shows = await Promise.all(showIds.map((id) => getShow(id)));

  return new Map(
    showIds.map((id, index) => [id, shows[index]?.prfnm ?? "알 수 없는 공연"]),
  );
}

export type MyUpload = {
  id: number;
  showId: string;
  showName: string;
  createdAt: string;
  images: string[];
};

export async function getMyUploads(userId: string): Promise<MyUpload[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("uploads")
    .select("id, show_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const uploads = data as {
    id: number;
    show_id: string;
    created_at: string;
  }[];

  const showNameById = await getShowNames([
    ...new Set(uploads.map(({ show_id }) => show_id)),
  ]);

  return Promise.all(
    uploads.map(async (upload) => ({
      id: upload.id,
      showId: upload.show_id,
      showName: showNameById.get(upload.show_id) ?? "알 수 없는 공연",
      createdAt: upload.created_at,
      images: await getUploadImages(upload.id),
    })),
  );
}

export type MyContributionStats = {
  favoriteActorCount: number;
  uploadCount: number;
  reportedSlotCount: number;
};

export async function getMyContributionStats(
  userId: string,
): Promise<MyContributionStats> {
  const supabase = await createClient();

  const [favorites, uploads, assignments] = await Promise.all([
    supabase
      .from("favorites")
      .select("actor_id", { count: "exact", head: true }),
    supabase
      .from("uploads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("assignments")
      .select("slot_id, uploads!inner(user_id)")
      .eq("uploads.user_id", userId),
  ]);

  if (favorites.error) throw favorites.error;
  if (uploads.error) throw uploads.error;
  if (assignments.error) throw assignments.error;

  const reportedSlotCount = new Set(
    (assignments.data as { slot_id: number }[]).map(({ slot_id }) => slot_id),
  ).size;

  return {
    favoriteActorCount: favorites.count ?? 0,
    uploadCount: uploads.count ?? 0,
    reportedSlotCount,
  };
}

export type MySlot = {
  id: number;
  showId: string;
  showName: string;
  // YYYY-MM-DD
  date: string;
  // HH:mm
  time: string;
  casting: { role: string; actor: string; actorId: number | null }[];
};

// 담아둔 회차 중 보고 있는 달과 겹치는 것만 조회
export async function getMySlots(
  userId: string,
  start: string,
  end: string,
): Promise<MySlot[]> {
  const supabase = await createClient();

  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("my_slots")
    .select("slot_id")
    .eq("user_id", userId);

  if (bookmarksError) throw bookmarksError;

  const slotIds = (bookmarks ?? []).map(({ slot_id }) => slot_id);

  if (slotIds.length === 0) return [];

  const { data, error } = await supabase
    .from("slot_castings")
    .select(
      "slot_id, show_id, date, time, role_name_raw, actor_name_raw, actor_id, assignment_id",
    )
    .in("slot_id", slotIds)
    .gte("date", start)
    .lte("date", end)
    .order("date")
    .order("time")
    .order("assignment_id");

  if (error) throw error;

  const rows = data as {
    slot_id: number;
    show_id: string;
    date: string;
    time: string;
    role_name_raw: string;
    actor_name_raw: string;
    actor_id: number | null;
  }[];

  const slotsById = new Map<number, MySlot>();

  for (const row of rows) {
    const slot = slotsById.get(row.slot_id) ?? {
      id: row.slot_id,
      showId: row.show_id,
      showName: "",
      date: row.date,
      time: row.time.slice(0, 5),
      casting: [],
    };

    slot.casting.push({
      role: row.role_name_raw,
      actor: row.actor_name_raw,
      actorId: row.actor_id,
    });
    slotsById.set(row.slot_id, slot);
  }

  const slots = [...slotsById.values()];
  const showNameById = await getShowNames([
    ...new Set(slots.map(({ showId }) => showId)),
  ]);

  return slots.map((slot) => ({
    ...slot,
    showName: showNameById.get(slot.showId) ?? "알 수 없는 공연",
  }));
}

export async function getMyEvents(
  userId: string,
  start: string,
  end: string,
): Promise<CalendarEvent[]> {
  const supabase = await createClient();

  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("my_event_groups")
    .select("group_id, date")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);

  if (bookmarksError) throw bookmarksError;

  if (!bookmarks || bookmarks.length === 0) return [];

  const groupIds = bookmarks.map(({ group_id }) => group_id);
  const dateByGroupId = new Map(
    bookmarks.map(({ group_id, date }) => [group_id, date]),
  );

  const { data, error } = await supabase
    .from("current_events")
    .select(
      "id, group_id, show_id, title, description, upload_id, upload_image_id, edited",
    )
    .in("group_id", groupIds);

  if (error) throw error;

  const rows = data as {
    id: number;
    group_id: number;
    show_id: string;
    title: string;
    description: string | null;
    upload_id: number;
    upload_image_id: number;
    edited: boolean;
  }[];

  const showIdById = new Map(rows.map(({ id, show_id }) => [id, show_id]));
  const slotIdsByEvent = await getSlotIdsByEvent(
    supabase,
    rows.map(({ id }) => id),
  );

  const events: ShowEvent[] = rows.map((row) => {
    const anchorDate = dateByGroupId.get(row.group_id) ?? "";

    return {
      id: row.id,
      groupId: row.group_id,
      title: row.title,
      description: row.description,
      periodStart: anchorDate,
      periodEnd: anchorDate,
      slotIds: slotIdsByEvent.get(row.id) ?? [],
      uploadId: row.upload_id,
      uploadImageId: row.upload_image_id,
      edited: row.edited,
    };
  });

  const [eventsWithStatus, showNameById] = await Promise.all([
    getEventsWithReportStatus(events),
    getShowNames([...new Set(rows.map(({ show_id }) => show_id))]),
  ]);

  return eventsWithStatus.map((event) => {
    const showId = showIdById.get(event.id) ?? "";

    return {
      ...event,
      showId,
      showName: showNameById.get(showId) ?? "알 수 없는 공연",
      readOnly: true,
    };
  });
}
