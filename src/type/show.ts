export type GenreCode =
  | "AAAA"
  | "BBBC"
  | "BBBE"
  | "CCCA"
  | "CCCC"
  | "CCCD"
  | "EEEA"
  | "EEEB"
  | "GGGA";

export type GenreName =
  | "연극"
  | "무용(서양/한국무용)"
  | "대중무용"
  | "서양음악(클래식)"
  | "한국음악(국악)"
  | "대중음악"
  | "복합"
  | "서커스/마술"
  | "뮤지컬";

export const GENRE_MAP = {
  AAAA: "연극",
  BBBC: "무용(서양/한국무용)",
  BBBE: "대중무용",
  CCCA: "서양음악(클래식)",
  CCCC: "한국음악(국악)",
  CCCD: "대중음악",
  EEEA: "복합",
  EEEB: "서커스/마술",
  GGGA: "뮤지컬",
} as const satisfies Record<GenreCode, GenreName>;

export type StateCode = "01" | "02" | "03";

export type StateName = "공연예정" | "공연중" | "공연완료";

export const STATE_MAP = {
  "01": "공연예정",
  "02": "공연중",
  "03": "공연완료",
} as const satisfies Record<StateCode, StateName>;

export type StateKey = "upcoming" | "ongoing" | "ended";

export const STATE_KEY_MAP = {
  공연예정: "upcoming",
  공연중: "ongoing",
  공연완료: "ended",
} as const satisfies Record<StateName, StateKey>;

export type AreaCode =
  | "11"
  | "UNI"
  | "28"
  | "30"
  | "27"
  | "29"
  | "26"
  | "31"
  | "36"
  | "41"
  | "43|44"
  | "45|46"
  | "47|48"
  | "50"
  | "51";

export type AreaName =
  | "서울"
  | "대학로"
  | "인천"
  | "대전"
  | "대구"
  | "광주"
  | "부산"
  | "울산"
  | "세종"
  | "경기"
  | "충청"
  | "경상"
  | "전라"
  | "강원"
  | "제주";

export const AREA_MAP = {
  "11": "서울",
  UNI: "대학로",
  "28": "인천",
  "30": "대전",
  "27": "대구",
  "29": "광주",
  "26": "부산",
  "31": "울산",
  "36": "세종",
  "41": "경기",
  "43|44": "충청",
  "45|46": "전라",
  "47|48": "경상",
  "50": "제주",
  "51": "강원",
} as const satisfies Record<AreaCode, AreaName>;

export type AreaGroupCode = "ALL" | "DAEHAKRO" | "METRO" | "NON_METRO";
export const AREA_GROUP = {
  ALL: [],
  DAEHAKRO: ["UNI"],
  METRO: ["11", "28", "41"],
  NON_METRO: [
    "30",
    "27",
    "29",
    "26",
    "31",
    "36",
    "43|44",
    "45|46",
    "47|48",
    "50",
    "51",
  ],
} as const satisfies Record<AreaGroupCode, readonly AreaCode[]>;

export const AREA_GROUP_MAP = {
  ALL: "전체",
  DAEHAKRO: "대학로",
  METRO: "수도권",
  NON_METRO: "비수도권",
} as const satisfies Record<AreaGroupCode, string>;

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
