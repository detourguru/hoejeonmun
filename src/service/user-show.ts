import "server-only";

import { getToday, toInputDate } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GENRE, GenreName, Show, ShowDetail, StateName } from "@/type/show";
import {
  MAX_TICKET_LINKS,
  TicketLink,
  USER_SHOW_POSTER_BUCKET,
  UserShowInput,
} from "@/type/user-show";

export const USER_SHOW_ID_PREFIX = "local-";

export const isUserShowId = (id: string) => id.startsWith(USER_SHOW_ID_PREFIX);

type UserShowRow = {
  id: string;
  title: string;
  poster_path: string;
  period_start: string;
  period_end: string;
  genre: GenreName;
  venue: string;
  ticket_links: TicketLink[];
};

const toKopisDateFormat = (isoDate: string) => isoDate.replaceAll("-", ".");

// 종료된 공연은 KOPIS 목록/검색에서도 자연히 빠지므로 진행중/예정 둘만 구분한다
function computeState(periodStart: string): StateName {
  return toInputDate(getToday()) < periodStart ? "공연예정" : "공연중";
}

async function toShowDetail(row: UserShowRow): Promise<ShowDetail> {
  const supabase = createAdminClient();
  const {
    data: { publicUrl },
  } = supabase.storage
    .from(USER_SHOW_POSTER_BUCKET)
    .getPublicUrl(row.poster_path);

  return {
    mt20id: row.id,
    prfnm: row.title,
    prfpdfrom: toKopisDateFormat(row.period_start),
    prfpdto: toKopisDateFormat(row.period_end),
    fcltynm: row.venue,
    poster: publicUrl,
    area: "",
    genrenm: row.genre,
    openrun: "N",
    prfstate: computeState(row.period_start),
    relates:
      row.ticket_links.length > 0
        ? {
            relate: row.ticket_links.map(({ name, url }) => ({
              relatenm: name,
              relateurl: url,
            })),
          }
        : undefined,
  };
}

export async function getUserShow(id: string): Promise<ShowDetail | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("user_shows")
    .select(
      "id, title, poster_path, period_start, period_end, genre, venue, ticket_links",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return toShowDetail(data as UserShowRow);
}

export async function searchUserShows(keyword: string): Promise<Show[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("user_shows")
      .select("id, title, poster_path, period_start, period_end, genre, venue")
      .ilike("title", `%${keyword}%`);

    if (error) throw error;

    const rows = data as Omit<UserShowRow, "ticket_links">[];

    return await Promise.all(
      rows.map((row) => toShowDetail({ ...row, ticket_links: [] })),
    );
  } catch (error) {
    console.error("사용자 등록 공연 검색 실패", error);

    return [];
  }
}

export async function createUserShow(
  input: UserShowInput,
  userId: string,
): Promise<{ id: string }> {
  const supabase = await createClient();

  const id = `${USER_SHOW_ID_PREFIX}${crypto.randomUUID()}`;

  const { error } = await supabase.from("user_shows").insert({
    id,
    title: input.title.trim(),
    poster_path: input.posterPath,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    genre: GENRE.nameByCode[input.genre],
    venue: input.venue.trim(),
    ticket_links: input.ticketLinks
      .filter(({ name, url }) => name.trim() && url.trim())
      .slice(0, MAX_TICKET_LINKS),
    created_by: userId,
  });

  if (error) throw error;

  return { id };
}
