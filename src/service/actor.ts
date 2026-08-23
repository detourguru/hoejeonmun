import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getShow } from "@/service/show";

const REVALIDATE = 60 * 5;

export const ACTORS_CACHE_TAG = "actors";

export type Actor = {
  id: number;
  name: string;
};

export type ActorSlot = {
  id: number;
  showId: string;
  showName: string;
  // YYYY-MM-DD
  date: string;
  // HH:mm
  time: string;
  role: string;
};

type ActorSlotRow = {
  slot_id: number;
  show_id: string;
  date: string;
  time: string;
  role_name_raw: string;
};

export async function getActor(id: number): Promise<Actor | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("actors")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  return data;
}

// 공연명을 못 찾으면 회차를 버리지 않고 안내 문구로 대체한다.
async function getShowNames(showIds: string[]) {
  const shows = await Promise.all(
    showIds.map(async (showId) => [showId, await getShow(showId)] as const),
  );

  return new Map(
    shows.map(([showId, show]) => [showId, show?.prfnm ?? "공연 정보 없음"]),
  );
}

export async function getActorSchedule(
  actorId: number,
  start: string,
  end: string,
): Promise<ActorSlot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("slot_castings")
    .select("slot_id, show_id, date, time, role_name_raw")
    .eq("actor_id", actorId)
    .gte("date", start)
    .lte("date", end)
    .order("date")
    .order("time");

  if (error) throw error;

  const rows = data as ActorSlotRow[];
  const showNames = await getShowNames([
    ...new Set(rows.map(({ show_id }) => show_id)),
  ]);

  return rows.map((row) => ({
    id: row.slot_id,
    showId: row.show_id,
    showName: showNames.get(row.show_id) ?? "공연 정보 없음",
    date: row.date,
    // HH:mm:ss
    time: row.time.slice(0, 5),
    role: row.role_name_raw,
  }));
}

// 배우가 태깅된 공연 목록. 기간 제한 없이 전부 본다
export async function getActorShows(actorId: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("slot_castings")
    .select("show_id")
    .eq("actor_id", actorId);

  if (error) throw error;

  const showIds = [
    ...new Set((data as { show_id: string }[]).map(({ show_id }) => show_id)),
  ];

  const showNames = await getShowNames(showIds);

  return showIds.map((showId) => ({
    showId,
    showName: showNames.get(showId) ?? "공연 정보 없음",
  }));
}

export async function getActorIdsByNames(names: string[]) {
  if (names.length === 0) return new Map<string, number>();

  const entries = await unstable_cache(
    async (names: string[]) => {
      const supabase = createAdminClient();

      // 캐스팅 보드 표기와 KOPIS 제공 이름이 항상 같지 않을 수 있으므로 in 조회
      const { data, error } = await supabase
        .from("actors")
        .select("id, name")
        .in("name", names);

      if (error) throw error;

      return data.map(({ id, name }) => [name, id] as const);
    },
    ["actor-ids-by-names"],
    { tags: [ACTORS_CACHE_TAG], revalidate: REVALIDATE },
  )(names);

  return new Map(entries);
}

const SEARCH_LIMIT = 20;

export async function searchActors(keyword: string): Promise<Actor[]> {
  const escaped = keyword.replace(/[%_\\]/g, "");

  if (!escaped) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("actors")
    .select("id, name")
    .ilike("name", `%${escaped}%`)
    .order("name")
    .limit(SEARCH_LIMIT);

  if (error) throw error;

  return data;
}

export async function getFavoriteActors(): Promise<Actor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("favorites")
    .select("actors(id, name)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as unknown as { actors: Actor }[]).map(({ actors }) => actors);
}

export async function isFavorited(actorId: number) {
  const supabase = await createClient();

  // RLS가 본인 행만 돌려주므로 user_id 조건이 따로 필요 없다
  const { data } = await supabase
    .from("favorites")
    .select("actor_id")
    .eq("actor_id", actorId)
    .maybeSingle();

  return Boolean(data);
}
