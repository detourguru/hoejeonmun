import { isOpeningOrClosingEvent, isPreviewEvent } from "@/lib/event-slots";

type EventKind = "opening" | "preview" | "normal";

const getEventKind = (title: string): EventKind =>
  isOpeningOrClosingEvent(title)
    ? "opening"
    : isPreviewEvent(title)
      ? "preview"
      : "normal";

// 브랜드 토큰만 쓴다. 일반 이벤트는 point, 첫공/막공은 point를 진하게, 프리뷰는 primary로 구분한다
const BAR_COLORS: Record<EventKind, string> = {
  opening: "bg-point",
  preview: "bg-primary/25",
  normal: "bg-point/50",
};

const CARD_COLORS: Record<EventKind, string> = {
  opening: "bg-point/35",
  preview: "bg-primary/10",
  normal: "bg-point/10",
};

export const getEventBarColor = (title: string) =>
  BAR_COLORS[getEventKind(title)];

export const getEventCardColor = (title: string) =>
  CARD_COLORS[getEventKind(title)];

const EVENT_COLORS = [
  "bg-point text-text",
  "bg-point/55 text-text",
  "bg-point/30 text-text",
  "bg-point/15 text-text",
  "bg-transparent text-text",
] as const;

export function getEventColorMap(ids: number[]): Map<number, string> {
  const unique = [...new Set(ids)].sort((a, b) => a - b);

  return new Map(
    unique.map((id, index) => [id, EVENT_COLORS[index % EVENT_COLORS.length]]),
  );
}
