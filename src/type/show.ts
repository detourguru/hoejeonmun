import { CodeOf, createCodeTable, NameOf } from "@/lib/code-table";

// 캐싱 상한 일자. 검색, 조회가 모두 이 기간 내에서만 이루어진다
export const SEARCHABLE_MONTHS = 3;

export const GENRE = createCodeTable([
  { value: "AAAA", label: "연극" },
  { value: "GGGA", label: "뮤지컬" },
]);

export type GenreCode = CodeOf<typeof GENRE>;
export type GenreName = NameOf<typeof GENRE>;

export const STATE = createCodeTable([
  { value: "01", label: "공연예정" },
  { value: "02", label: "공연중" },
]);

export type StateCode = CodeOf<typeof STATE>;
export type StateName = NameOf<typeof STATE>;

export const AREA = createCodeTable([
  { value: "11", label: "서울" },
  { value: "28", label: "인천" },
  { value: "30", label: "대전" },
  { value: "27", label: "대구" },
  { value: "29", label: "광주" },
  { value: "26", label: "부산" },
  { value: "31", label: "울산" },
  { value: "36", label: "세종" },
  { value: "41", label: "경기" },
  { value: "43|44", label: "충청" },
  { value: "45|46", label: "전라" },
  { value: "47|48", label: "경상" },
  { value: "50", label: "제주" },
  { value: "51", label: "강원" },
]);

export type AreaCode = CodeOf<typeof AREA>;
export type AreaName = NameOf<typeof AREA>;

// 43|44 처럼 코드 하나가 두 시도를 묶는 경우가 있어 값이 배열이다
export const AREA_NAMES_BY_CODE: Record<AreaCode, readonly string[]> = {
  "11": ["서울특별시"],
  "26": ["부산광역시"],
  "27": ["대구광역시"],
  "28": ["인천광역시"],
  "29": ["광주광역시"],
  "30": ["대전광역시"],
  "31": ["울산광역시"],
  "36": ["세종특별자치시"],
  "41": ["경기도"],
  "43|44": ["충청북도", "충청남도"],
  "45|46": ["전라북도", "전라남도"],
  "47|48": ["경상북도", "경상남도"],
  "50": ["제주특별자치도"],
  "51": ["강원특별자치도"],
};

/**
 * TODO: 규모(중소극장 / 대극장) 필터
 * mvp 기능이지만 좌석수가 공연목록/공연상세 응답에 없고 공연시설상세(/prfplc/{mt10id})에만 있어
 * 시설 정보를 자체 DB에 미러링한 뒤 붙일 것
 */

export const SHOW_FEED_TAB = createCodeTable([
  { value: "favorite", label: "애정배우" },
  { value: "recent", label: "최근소식" },
]);

export type ShowFeedTab = CodeOf<typeof SHOW_FEED_TAB>;

export const DEFAULT_SHOW_FEED_TAB: ShowFeedTab = "favorite";

// Kopis 제공 코드 아님
export const SORT = createCodeTable([
  { value: "openDate", label: "개막일순" },
  { value: "closeDate", label: "종료일순" },
]);

export type SortKey = CodeOf<typeof SORT>;

export const DEFAULT_SORT: SortKey = "closeDate"; // 오픈런 공연이 있어 폐막일 순으로 정렬

// 정렬은 '전체' 항목이 필요없으므로 뺀다
export const SORT_OPTIONS = SORT.options.filter(
  ({ value }) => value !== DEFAULT_SORT,
);

export type Show = {
  mt20id: string;
  prfnm: string;
  prfpdfrom: string;
  prfpdto: string;
  fcltynm: string;
  poster: string;
  area: string;
  genrenm: GenreName;
  openrun: "N" | "Y";
  prfstate: StateName;
};

export type ShowRelate = {
  relatenm: string;
  relateurl: string;
};

// 값이 없는 항목은 태그 자체가 빠지거나 빈 문자열로 오기때문에 optional
export type ShowDetail = Show & {
  mt10id?: string;
  prfcast?: string;
  prfcrew?: string;
  prfruntime?: string;
  prfage?: string;
  entrpsnm?: string;
  pcseguidance?: string;
  sty?: string;
  dtguidance?: string;
  daehakro?: "N" | "Y";
  styurls?: { styurl?: string | string[] };
  relates?: { relate?: ShowRelate | ShowRelate[] };
};
