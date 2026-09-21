import { unstable_cache } from "next/cache";

import {
  addDays,
  addMonths,
  getToday,
  normalizeDate,
  toKopisDate,
} from "@/lib/date";
import { fetchKopis, fetchKopisAll, KOPIS_MAX_ROWS } from "@/lib/kopis";
import { parseRuntimeMinutes } from "@/lib/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectAllRows } from "@/lib/supabase/select-all";
import {
  getUserShow,
  isUserShowId,
  searchUserShows,
} from "@/service/user-show";
import { getVenueSeatScales } from "@/service/venue";
import {
  AREA,
  AREA_NAMES_BY_CODE,
  AreaCode,
  DEFAULT_SORT,
  GENRE,
  GenreCode,
  LARGE_VENUE_SEAT_THRESHOLD,
  SEARCHABLE_MONTHS,
  Show,
  ShowDetail,
  SORT,
  SortKey,
  STATE,
  StateCode,
  StateName,
  VENUE_TYPE,
  VenueTypeCode,
} from "@/type/show";

const REVALIDATE = 60 * 60;
const MAX_PAGES = 10;

export const PAGE_SIZE = 30;

export const SHOWS_CACHE_TAG = "shows";

export const showCacheTag = (id: string) => `show:${id}`;

// 값이 작을수록 우선 노출
const STATE_PRIORITY: Record<StateName, number> = {
  공연중: 0,
  공연예정: 1,
  공연완료: 2,
};

const compareState = (a: Show, b: Show) =>
  STATE_PRIORITY[a.prfstate] - STATE_PRIORITY[b.prfstate];

const SORT_COMPARATORS: Record<SortKey, (a: Show, b: Show) => number> = {
  openDate: (a, b) =>
    compareState(a, b) ||
    a.prfpdfrom.localeCompare(b.prfpdfrom) ||
    a.prfnm.localeCompare(b.prfnm),
  closeDate: (a, b) =>
    compareState(a, b) ||
    a.prfpdto.localeCompare(b.prfpdto) ||
    a.prfnm.localeCompare(b.prfnm),
};

export type ShowFilters = {
  shcate?: GenreCode;
  prfstate?: StateCode;
  signgucode?: AreaCode;
  shprfnm?: string;
  sort?: SortKey;
  venueType?: VenueTypeCode;
  page: number;
  // YYYYMMDD
  from: string;
  to: string;
};

// 오늘 + SEARCHABLE_MONTHS 개월
function getPeriod() {
  const today = getToday();

  return {
    stdate: toKopisDate(today),
    eddate: toKopisDate(addMonths(today, SEARCHABLE_MONTHS)),
  };
}

async function fetchShowsForPeriod(stdate: string, eddate: string) {
  const pages = await Promise.all(
    // or 필터를 지원하지 않으므로 모든 장르를 순회를 돌며 조회 후 합친다
    GENRE.codes.map((shcate) => {
      const params = new URLSearchParams({ stdate, eddate, shcate });

      return fetchKopisAll<Show>("/pblprfr", params, {
        rows: KOPIS_MAX_ROWS,
        maxPages: MAX_PAGES,
        revalidate: REVALIDATE,
        tags: [SHOWS_CACHE_TAG],
      });
    }),
  );

  return pages.flat().filter((show) => show?.mt20id);
}

const PAST_CHUNK_DAYS = 31;

const parseKopisDate = (value: string) =>
  new Date(
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(4, 6)) - 1,
      Number(value.slice(6, 8)),
    ),
  );

async function fetchPastShows(from: string, to: string) {
  const end = parseKopisDate(to);
  const periods: [string, string][] = [];

  for (
    let start = parseKopisDate(from);
    start <= end;
    start = addDays(start, PAST_CHUNK_DAYS)
  ) {
    const chunkEnd = addDays(start, PAST_CHUNK_DAYS - 1);

    periods.push([
      toKopisDate(start),
      toKopisDate(chunkEnd < end ? chunkEnd : end),
    ]);
  }

  const chunks = await Promise.all(
    periods.map(([stdate, eddate]) => fetchShowsForPeriod(stdate, eddate)),
  );

  return chunks.flat();
}

export async function getShows(pastRange?: {
  from: string;
  to: string;
}): Promise<Show[]> {
  const { stdate, eddate } = getPeriod();

  const needsPastFetch = pastRange && pastRange.from < stdate;

  const [defaultShows, pastShows] = await Promise.all([
    fetchShowsForPeriod(stdate, eddate),
    needsPastFetch
      ? fetchPastShows(
          pastRange.from,
          pastRange.to < stdate ? pastRange.to : stdate,
        )
      : Promise.resolve([]),
  ]);

  if (pastShows.length === 0) return defaultShows;

  // 여러 구간에 걸친 공연은 구간마다 중복해서 나오므로 id로 한 번만 담는다
  const showsById = new Map(defaultShows.map((show) => [show.mt20id, show]));

  for (const show of pastShows) {
    if (!showsById.has(show.mt20id)) showsById.set(show.mt20id, show);
  }

  return [...showsById.values()];
}

// 없는 mt20id를 넘기면 Kopis가 빈 dbs를 주므로 null로 구분
export async function getShow(id: string): Promise<ShowDetail | null> {
  if (isUserShowId(id)) return getUserShow(id);

  const [show] = await fetchKopis<ShowDetail>(
    `/pblprfr/${encodeURIComponent(id)}`,
    new URLSearchParams(),
    { revalidate: REVALIDATE, tags: [SHOWS_CACHE_TAG, showCacheTag(id)] },
  );

  return show ?? null;
}

const getFirstFromArray = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const pickCode = <T extends string>(
  value: string | string[] | undefined,
  isCode: (value: unknown) => value is T,
): T | undefined => {
  const parsed = getFirstFromArray(value);

  return isCode(parsed) ? parsed : undefined;
};

function pickPeriod(params: Record<string, string | string[] | undefined>) {
  const pickDate = (value: string | string[] | undefined) => {
    const digits = normalizeDate(getFirstFromArray(value) ?? "", "");

    return digits.length === 8 ? digits : "";
  };

  const from = pickDate(params.from) || toKopisDate(getToday());
  const to = pickDate(params.to) || from;

  return { from, to: to < from ? from : to };
}

function pickPage(value: string | string[] | undefined) {
  const parsed = Number(getFirstFromArray(value));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

// 허용된 필터만 여기에 추가
export function parseShowFilters(
  params: Record<string, string | string[] | undefined>,
): ShowFilters {
  return {
    shcate: pickCode(params.shcate, GENRE.isCode),
    prfstate: pickCode(params.prfstate, STATE.isCode),
    signgucode: pickCode(params.signgucode, AREA.isCode),
    shprfnm: getFirstFromArray(params.shprfnm)?.trim() || undefined,
    sort: pickCode(params.sort, SORT.isCode),
    venueType: pickCode(params.venueType, VENUE_TYPE.isCode),
    ...pickPeriod(params),
    page: pickPage(params.page),
  };
}

// 띄어쓰기, 대소문자 무시
const normalizeText = (text: string) => text.replace(/\s+/g, "").toLowerCase();

export function filterShows(shows: Show[], filters: ShowFilters): Show[] {
  const keyword = filters.shprfnm && normalizeText(filters.shprfnm);
  const state = filters.prfstate && STATE.nameByCode[filters.prfstate];
  const genre = filters.shcate && GENRE.nameByCode[filters.shcate];
  const areaNames =
    filters.signgucode && AREA_NAMES_BY_CODE[filters.signgucode];

  return shows.filter((show) => {
    if (genre && show.genrenm !== genre) return false;

    if (state && show.prfstate !== state) return false;

    if (areaNames && !areaNames.includes(show.area)) return false;

    if (keyword && !normalizeText(show.prfnm).includes(keyword)) return false;

    // Kopis는 이날 공연 회차가 있는지 여부가 아닌 공연 기간을 기준으로 반환한다
    if (normalizeDate(show.prfpdfrom, "") > filters.to) return false;
    if (normalizeDate(show.prfpdto, "") < filters.from) return false;

    return true;
  });
}

export async function filterShowsByVenue(
  shows: Show[],
  filters: ShowFilters,
): Promise<Show[]> {
  if (!filters.venueType) return shows;

  const details = await Promise.all(
    shows.map((show) => getShow(show.mt20id).catch(() => null)),
  );

  if (filters.venueType === "daehakro") {
    return shows.filter((_, index) => details[index]?.daehakro === "Y");
  }

  const mt13ids = details
    .map((detail) => detail?.mt13id)
    .filter((mt13id): mt13id is string => !!mt13id);

  const seatScaleByMt13id = await getVenueSeatScales(mt13ids);

  return shows.filter((_, index) => {
    const detail = details[index];

    const seatScale = detail?.mt13id
      ? (seatScaleByMt13id.get(detail.mt13id) ?? null)
      : null;

    return seatScale != null && seatScale >= LARGE_VENUE_SEAT_THRESHOLD;
  });
}

export function paginateShows(shows: Show[], page: number) {
  // 요청 범위가 페이지 수보다 많거나 적어도 max/min 페이지를 반환
  const totalPages = Math.max(1, Math.ceil(shows.length / PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = (current - 1) * PAGE_SIZE;

  return {
    items: shows.slice(start, start + PAGE_SIZE),
    page: current,
    totalPages,
  };
}

export function sortShows(shows: Show[], sort: SortKey = DEFAULT_SORT): Show[] {
  return [...shows].sort(SORT_COMPARATORS[sort]);
}

const SEARCH_TERM_LIMIT = 20;

const UPLOADED_SHOW_IDS_REVALIDATE = 60 * 60;

const getUploadedShowIds = unstable_cache(
  async () => {
    const supabase = createAdminClient();

    const rows = await selectAllRows<{ show_id: string }>((from, to) =>
      supabase.from("uploads").select("show_id").range(from, to),
    );

    return [...new Set(rows.map((row) => row.show_id))];
  },
  ["uploaded-show-ids"],
  { revalidate: UPLOADED_SHOW_IDS_REVALIDATE },
);

function getSearchPastRange() {
  const today = getToday();

  return {
    from: toKopisDate(addMonths(today, -SEARCHABLE_MONTHS)),
    to: toKopisDate(today),
  };
}

export async function searchShows(keyword: string): Promise<Show[]> {
  const normalized = normalizeText(keyword);

  if (!normalized) return [];

  const [kopisShows, userShows, uploadedShowIds] = await Promise.all([
    getShows(getSearchPastRange()).catch((error) => {
      console.error("종료된 공연 조회 실패", error);

      return getShows();
    }),
    searchUserShows(keyword),
    getUploadedShowIds(),
  ]);

  const matched = kopisShows.filter((show) =>
    normalizeText(show.prfnm).includes(normalized),
  );

  const knownIds = new Set([
    ...kopisShows.map((show) => show.mt20id),
    ...userShows.map((show) => show.mt20id),
  ]);

  const endedShowCandidates = (
    await Promise.all(
      uploadedShowIds
        .filter((id) => !knownIds.has(id))
        .map((id) => getShow(id).catch(() => null)),
    )
  ).filter((show): show is ShowDetail => show !== null);

  const endedShows = endedShowCandidates.filter((show) =>
    normalizeText(show.prfnm).includes(normalized),
  );

  return sortShows([...userShows, ...matched, ...endedShows]).slice(
    0,
    SEARCH_TERM_LIMIT,
  );
}

export async function getShowNames(
  showIds: string[],
): Promise<Map<string, string>> {
  const shows = await Promise.all(showIds.map((id) => getShow(id)));

  return new Map(
    showIds.map((id, index) => [id, shows[index]?.prfnm ?? "알 수 없는 공연"]),
  );
}

export type ShowSummary = {
  name: string;
  poster: string;
  daehakro?: "N" | "Y";
  mt13id?: string;
  // KOPIS 에 없는 공연(null)과 달리 조회 자체가 실패해 정보를 모르는 상태
  lookupFailed: boolean;
};

// 목록의 공연 하나가 조회에 실패해도 나머지는 보여준다
export async function getShowSummaries(
  showIds: string[],
): Promise<Map<string, ShowSummary>> {
  const results = await Promise.all(
    showIds.map((id) =>
      getShow(id).then(
        (show) => ({ show, lookupFailed: false }),
        (error) => {
          console.error("공연 요약 조회 실패", id, error);

          return { show: null, lookupFailed: true };
        },
      ),
    ),
  );

  return new Map(
    showIds.map((id, index) => {
      const { show, lookupFailed } = results[index];

      return [
        id,
        {
          name: show?.prfnm ?? "알 수 없는 공연",
          poster: show?.poster ?? "",
          daehakro: show?.daehakro,
          mt13id: show?.mt13id,
          lookupFailed,
        },
      ];
    }),
  );
}

export async function getShowRuntimes(
  showIds: string[],
): Promise<Record<string, number | null>> {
  const shows = await Promise.all(showIds.map((id) => getShow(id)));

  return Object.fromEntries(
    showIds.map((id, index) => [
      id,
      parseRuntimeMinutes(shows[index]?.prfruntime),
    ]),
  );
}
