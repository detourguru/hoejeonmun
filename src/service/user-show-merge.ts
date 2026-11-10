import "server-only";

import { fetchKopisAll } from "@/lib/kopis";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENRE, Show } from "@/type/show";

import { SHOWS_CACHE_TAG } from "./show";

type UserShowRow = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  venue: string;
};

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

  const { data, error } = await admin.rpc("merge_user_show", {
    p_from: userShow.id,
    p_to: kopisShowId,
  });
  if (error) throw error;
  const slots = data as { moved: number; merged: number };
  const counts: Record<string, number> = {};
  const failures: string[] = [];

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
