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

// 행 = 날짜 x 시간, 열 = 배역, 셀 = 배우명
export type ParsedPerformance = {
  // YYYY-MM-DD
  date: string;
  weekday: string;
  // HH:mm
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
