import { CodeOf, createCodeTable } from "@/lib/code-table";

export const CASTING_BOARD_BUCKET = "casting-boards";

// KOPIS 제공 코드 아님
export const CASTING_VIEW = createCodeTable([
  { value: "calendar", label: "달력" },
  { value: "list", label: "목록" },
]);

export type CastingView = CodeOf<typeof CASTING_VIEW>;

export const DEFAULT_CASTING_VIEW: CastingView = "calendar";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// 배우 필터 규칙
export const ACTORS_PARAM = "actors";
export const ACTORS_SEPARATOR = ",";

export const parseActorsParam = (
  value: string | undefined,
  options: string[],
) =>
  (value?.split(ACTORS_SEPARATOR) ?? []).filter((name) =>
    options.includes(name),
  );

export type CalendarSlot = {
  id: number;
  // YYYY-MM-DD
  date: string;
  // HH:mm
  time: string;
  label: string;
  colorClass?: string;
  filterKeys?: string[];
};

export type ParsedPerformance = {
  date: string;
  weekday: string;
  time: string;
  // 배역명 -> 배우명
  casting: Record<string, string>;
  imageIndex: number;
};

// 캐스팅표에 붙은 배지(프리뷰/막공/커튼콜데이/더블적립위크 등).
export type ParsedDateTag = {
  tag: string;
  startDate: string;
  endDate: string;
  printedStartWeekday: string;
  printedEndWeekday: string;
  imageIndex: number;
};

// 이미지 전체가 캐스팅표가 아니라 특전/이벤트 안내인 경우
export type ParsedEvent = {
  title: string;
  // 타 공연 이벤트 올리는 것을 방지
  rawTitle: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  printedStartWeekday: string;
  printedEndWeekday: string;
  imageIndex: number;
};

export type CastingBoardResult = {
  uploadId: number;
  slotCount: number;
  actorCount: number;
  eventCount: number;
  skippedCount: number;
};
