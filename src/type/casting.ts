import { CodeOf, createCodeTable } from "@/lib/code-table";

export const CASTING_BOARD_BUCKET = "casting-boards";

export const SIGNED_URL_TTL_SECONDS = 60 * 60;

// KOPIS 제공 코드 아님
export const CASTING_VIEW = createCodeTable([
  { value: "calendar", label: "달력" },
  { value: "list", label: "목록" },
]);

export type CastingView = CodeOf<typeof CASTING_VIEW>;

export const DEFAULT_CASTING_VIEW: CastingView = "calendar";

// /show 최근 피드 탭
export const REPORT_TYPE_TAB = createCodeTable([
  { value: "casting", label: "캐스팅" },
  { value: "event", label: "이벤트" },
]);

export type ReportTypeTab = CodeOf<typeof REPORT_TYPE_TAB>;

export const DEFAULT_REPORT_TYPE_TAB: ReportTypeTab = "casting";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_COUNT = 5;
export const PARSE_TIMEOUT_SECONDS = 60;

export const UPLOAD_STEP = createCodeTable([
  { value: "selecting", label: "선택" },
  { value: "uploading", label: "업로드" },
  { value: "analyzing", label: "분석" },
  { value: "confirming", label: "확인" },
  { value: "saving", label: "저장" },
]);

export type UploadStatus = "idle" | CodeOf<typeof UPLOAD_STEP> | "done";

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

export type EventSource = "badge" | "notice";

// 코드 대조에 하나라도 실패했을 시 사용자 확인을 받는다
export type EventConfirmReason =
  "range_badge" | "no_printed_weekday" | "overlaps_existing";

export const EVENT_CONFIRM_MESSAGE: Record<EventConfirmReason, string> = {
  range_badge: "캐스팅표 여백 라벨에서 읽어서 기간이 어긋날 수 있어요.",
  no_printed_weekday: "이미지에 요일이 없어 날짜를 다시 확인하지 못했어요.",
  overlaps_existing: "이미 등록된 이벤트와 기간이 겹쳐요.",
};

export type ExistingEvent = {
  id: number;
  groupId: number;
  title: string;
  periodStart: string;
  periodEnd: string;
  source: EventSource;
  edited: boolean;
};

export type PendingEvent = {
  title: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  printedStartWeekday: string;
  printedEndWeekday: string;
  source: EventSource;
  imageIndex: number;
  confirmReasons: EventConfirmReason[];
  overlapping: ExistingEvent[];
  suggestedSameAsGroupId?: number;
};

export type ConfirmedEvent = PendingEvent & {
  // confirmReasons가 있으면 이게 참이어야 저장된다
  confirmed: boolean;
  edited: boolean;
  replacesGroupId?: number;
};

export type CastingBoardResult = {
  uploadId: number;
  slotCount: number;
  actorCount: number;
  eventCount: number;
  skippedCount: number;
};
