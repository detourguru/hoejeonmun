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
};

export type CastingBoardResult = {
  uploadId: number;
  slotCount: number;
  actorCount: number;
  skippedCount: number;
};
