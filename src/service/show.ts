import {
  addMonths,
  getToday,
  normalizeDate,
  toKopisDate,
} from "@/lib/date";
import { fetchKopisAll, KOPIS_MAX_ROWS } from "@/lib/kopis";
import {
  AREA,
  AREA_NAMES_BY_CODE,
  AreaCode,
  DEFAULT_SORT,
  GENRE,
  GenreCode,
  SEARCHABLE_MONTHS,
  Show,
  SORT,
  SortKey,
  STATE,
  StateCode,
} from "@/type/show";

const REVALIDATE = 60 * 60;
const MAX_PAGES = 10;

export const PAGE_SIZE = 30;

export const SHOWS_CACHE_TAG = "shows";

const SORT_COMPARATORS: Record<SortKey, (a: Show, b: Show) => number> = {
  openDate: (a, b) =>
    a.prfpdfrom.localeCompare(b.prfpdfrom) || a.prfnm.localeCompare(b.prfnm),
  closeDate: (a, b) =>
    a.prfpdto.localeCompare(b.prfpdto) || a.prfnm.localeCompare(b.prfnm),
};

export type ShowFilters = {
  shcate?: GenreCode;
  prfstate?: StateCode;
  signgucode?: AreaCode;
  shprfnm?: string;
  sort?: SortKey;
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

export async function getShows(): Promise<Show[]> {
  const { stdate, eddate } = getPeriod();

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
    const digits = normalizeDate(getFirstFromArray(value) ?? "");

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
    if (normalizeDate(show.prfpdfrom) > filters.to) return false;
    if (normalizeDate(show.prfpdto) < filters.from) return false;

    return true;
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
