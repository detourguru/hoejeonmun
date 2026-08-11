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

export const GENRE_OPTIONS: { value: GenreCode; label: GenreName }[] = [
  { value: "AAAA", label: "연극" },
  { value: "BBBC", label: "무용(서양/한국무용)" },
  { value: "BBBE", label: "대중무용" },
  { value: "CCCA", label: "서양음악(클래식)" },
  { value: "CCCC", label: "한국음악(국악)" },
  { value: "CCCD", label: "대중음악" },
  { value: "EEEA", label: "복합" },
  { value: "EEEB", label: "서커스/마술" },
  { value: "GGGA", label: "뮤지컬" },
];

export type StateCode = "01" | "02" | "03";

export type StateName = "공연예정" | "공연중" | "공연완료";

export const STATE_OPTIONS: { value: StateCode; label: StateName }[] = [
  { value: "01", label: "공연예정" },
  { value: "02", label: "공연중" },
  { value: "03", label: "공연완료" },
];

export type StateKey = "upcoming" | "ongoing" | "ended";

export const STATE_KEY_MAP = {
  공연예정: "upcoming",
  공연중: "ongoing",
  공연완료: "ended",
} as const satisfies Record<StateName, StateKey>;

export type AreaCode =
  | "11"
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

export const AREA_OPTIONS: { value: AreaCode; label: AreaName }[] = [
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
];

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
