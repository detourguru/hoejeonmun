import "server-only";

import { fetchKopisAll } from "@/lib/kopis";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENRE, Show } from "@/type/show";

import { SHOWS_CACHE_TAG } from "./show";

type Admin = ReturnType<typeof createAdminClient>;

type UserShowRow = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  venue: string;
};

const SHOW_ID_TABLES = [
  "uploads",
  "upload_images",
  "events",
  "parse_failures",
] as const;

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");

const toIsoDate = (kopisDate: string) => kopisDate.replaceAll(".", "-");

const toKopisDate = (isoDate: string) => isoDate.replaceAll("-", "");

const toSearchKeyword = (title: string) => {
  const head = title.split(/[,([:–—-]/)[0].trim();

  return (head.length >= 2 ? head : title.trim()).slice(0, 30);
};

const venueMatches = (userVenue: string, kopisVenue: string) => {
  const user = normalize(userVenue);

  if (!user) return false;

  return kopisVenue
    .split(/[[\]()\s]+/)
    .map(normalize)
    .filter((part) => part.length >= 2)
    .some((part) => user.includes(part) || part.includes(user));
};

async function fetchKopisShowsInPeriod(userShow: UserShowRow) {
  const pages = await Promise.all(
    GENRE.codes.map((shcate) =>
      fetchKopisAll<Show>(
        "/pblprfr",
        new URLSearchParams({
          stdate: toKopisDate(userShow.period_start),
          eddate: toKopisDate(userShow.period_end),
          shcate,
          shprfnm: toSearchKeyword(userShow.title),
        }),
        { maxPages: 1, revalidate: 0, tags: [SHOWS_CACHE_TAG] },
      ),
    ),
  );

  return pages.flat().filter((show) => show?.mt20id);
}

export async function findKopisTwin(
  userShow: UserShowRow,
): Promise<Show | null> {
  const title = normalize(userShow.title);

  if (title.length < 2) return null;

  const candidates = await fetchKopisShowsInPeriod(userShow);

  const matched = candidates.filter(
    (show) =>
      toIsoDate(show.prfpdfrom) === userShow.period_start &&
      toIsoDate(show.prfpdto) === userShow.period_end &&
      normalize(show.prfnm).includes(title) &&
      venueMatches(userShow.venue, show.fcltynm),
  );

  return matched.length === 1 ? matched[0] : null;
}

type SlotRow = { id: number; date: string; time: string };

// slots는 (show_id, date, time)이 겹칠 수 있어 겹치면 대상 회차로 합치고 원본을 지운다
async function mergeSlots(admin: Admin, fromShowId: string, toShowId: string) {
  const [
    { data: fromSlots, error: fromError },
    { data: toSlots, error: toError },
  ] = await Promise.all([
    admin.from("slots").select("id, date, time").eq("show_id", fromShowId),
    admin.from("slots").select("id, date, time").eq("show_id", toShowId),
  ]);

  if (fromError) throw fromError;
  if (toError) throw toError;

  const toSlotByKey = new Map(
    (toSlots as SlotRow[]).map((slot) => [
      `${slot.date} ${slot.time}`,
      slot.id,
    ]),
  );

  let moved = 0;
  let merged = 0;

  for (const slot of fromSlots as SlotRow[]) {
    const conflictId = toSlotByKey.get(`${slot.date} ${slot.time}`);

    if (!conflictId) {
      const { error } = await admin
        .from("slots")
        .update({ show_id: toShowId })
        .eq("id", slot.id);

      if (error) throw error;

      moved++;

      continue;
    }

    await moveOrDrop(admin, "event_slots", slot.id, conflictId, ["event_id"]);
    await moveOrDrop(admin, "my_slots", slot.id, conflictId, ["user_id"]);
    await moveOrDrop(admin, "vandal_reports", slot.id, conflictId, [
      "user_id",
      "upload_id",
    ]);
    await moveOrDrop(admin, "assignments", slot.id, conflictId, [
      "upload_id",
      "role_name_raw",
      "actor_name_raw",
    ]);

    const { error } = await admin.from("slots").delete().eq("id", slot.id);

    if (error) throw error;

    merged++;
  }

  return { moved, merged };
}

async function moveOrDrop(
  admin: Admin,
  table: string,
  fromSlotId: number,
  toSlotId: number,
  otherKeyColumns: string[],
) {
  const { data, error } = await admin
    .from(table)
    .select(["id", "slot_id", ...otherKeyColumns].join(", "))
    .eq("slot_id", fromSlotId);

  if (error) throw error;

  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    let query = admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("slot_id", toSlotId);

    for (const column of otherKeyColumns) {
      query = query.eq(column, row[column] as never);
    }

    const { count, error: countError } = await query;

    if (countError) throw countError;

    const keyMatch = {
      slot_id: fromSlotId,
      ...Object.fromEntries(otherKeyColumns.map((key) => [key, row[key]])),
    };

    const { error: writeError } =
      count && count > 0
        ? row.id != null
          ? await admin.from(table).delete().eq("id", row.id)
          : await admin.from(table).delete().match(keyMatch)
        : row.id != null
          ? await admin
              .from(table)
              .update({ slot_id: toSlotId })
              .eq("id", row.id)
          : await admin
              .from(table)
              .update({ slot_id: toSlotId })
              .match(keyMatch);

    if (writeError) throw writeError;
  }
}

async function moveShowIdRows(
  admin: Admin,
  fromShowId: string,
  toShowId: string,
) {
  const counts: Record<string, number> = {};
  const failures: string[] = [];

  for (const table of SHOW_ID_TABLES) {
    const { data, error } = await admin
      .from(table)
      .select("id")
      .eq("show_id", fromShowId);

    if (error) throw error;

    counts[table] = data?.length ?? 0;

    for (const row of data ?? []) {
      const { error: updateError } = await admin
        .from(table)
        .update({ show_id: toShowId })
        .eq("id", row.id);

      if (updateError)
        failures.push(`${table} id=${row.id}: ${updateError.message}`);
    }
  }

  return { counts, failures };
}

export type MergeResult = {
  fromShowId: string;
  toShowId: string;
  title: string;
  slots: { moved: number; merged: number };
  counts: Record<string, number>;
  failures: string[];
};

export async function mergeUserShowIntoKopis(
  userShow: UserShowRow,
  kopisShowId: string,
): Promise<MergeResult> {
  const admin = createAdminClient();

  const slots = await mergeSlots(admin, userShow.id, kopisShowId);
  const { counts, failures } = await moveShowIdRows(
    admin,
    userShow.id,
    kopisShowId,
  );

  if (failures.length === 0) {
    const { error } = await admin
      .from("user_shows")
      .delete()
      .eq("id", userShow.id);

    if (error) throw error;
  }

  return {
    fromShowId: userShow.id,
    toShowId: kopisShowId,
    title: userShow.title,
    slots,
    counts,
    failures,
  };
}

export type MergeUserShowsResult = {
  checked: number;
  merged: MergeResult[];
  skipped: { id: string; title: string }[];
};

export async function mergeUserShowsWithKopis(): Promise<MergeUserShowsResult> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("user_shows")
    .select("id, title, period_start, period_end, venue");

  if (error) throw error;

  const userShows = data as UserShowRow[];
  const merged: MergeResult[] = [];
  const skipped: { id: string; title: string }[] = [];

  for (const userShow of userShows) {
    const twin = await findKopisTwin(userShow);

    if (!twin) {
      skipped.push({ id: userShow.id, title: userShow.title });

      continue;
    }

    merged.push(await mergeUserShowIntoKopis(userShow, twin.mt20id));
  }

  return { checked: userShows.length, merged, skipped };
}
