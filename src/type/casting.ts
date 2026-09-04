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

// 캐스팅보드 업로드 검수 바텀시트 탭
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
  // 배역명 -> 배우명 목록 (앙상블처럼 한 배역에 배우가 여럿이면 여러 개)
  casting: Record<string, string[]>;
  imageIndex: number;
  confidence: number;
  castMismatch?: boolean;
  unsureRoles?: string[];
};

export const CAST_MISMATCH_WARNING =
  "이 공연 캐스팅과 겹치는 배우가 없어요. 원본과 대조해 확인해주세요.";

export const CASTING_CONSENSUS_WARNING =
  "AI 결과가 갈린 배역이 있어요. 원본과 대조해 확인해주세요.";

export type PerformanceSkipReason =
  | "invalid_date"
  | "invalid_time"
  | "out_of_range"
  | "weekday_mismatch"
  | "empty_casting"
  | "duplicate"
  | "invalid_image_index";

export const PERFORMANCE_SKIP_MESSAGE: Record<PerformanceSkipReason, string> = {
  invalid_date: "날짜 형식을 읽지 못했어요.",
  invalid_time: "시간 형식을 읽지 못했어요.",
  out_of_range: "공연 기간 밖의 날짜예요.",
  weekday_mismatch: "이미지에 적힌 요일과 날짜가 맞지 않아요.",
  empty_casting: "캐스팅 정보를 읽지 못했어요.",
  duplicate: "같은 날짜·시간이 이미 있어요.",
  invalid_image_index: "이미지 번호를 확인하지 못했어요.",
};

export type SkippedPerformance = {
  imageIndex: number;
  raw: ParsedPerformance;
  reason: PerformanceSkipReason;
};

// 캐스팅표에 붙은 배지(프리뷰/막공/커튼콜데이/더블적립위크 등).
export type ParsedDateTag = {
  tag: string;
  startDate: string;
  endDate: string;
  printedStartWeekday: string;
  printedEndWeekday: string;
  // HH:mm. 그 날짜 중 이 배지가 찍힌 한 회차에만 적용될 때만 채워짐, 그 외엔 ""
  time: string;
  imageIndex: number;
  slots?: EventSlotException[];
};

// 기간 범위 내에 존재하지 않는 날짜의 이벤트의 경우 예외로 처리한다
export type EventSlotException = {
  // YYYY-MM-DD
  date: string;
  // HH:mm
  time: string;
};

// 이미지 전체가 캐스팅표가 아니라 특전/이벤트 안내인 경우
export type ParsedEvent = {
  title: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  printedStartWeekday: string;
  printedEndWeekday: string;
  imageIndex: number;
  includedSlots?: EventSlotException[];
  excludedSlots?: EventSlotException[];
  exactTimes?: string[];
  listedSlots?: EventSlotException[];
  periodStartCutoffTime?: string;
  periodEndCutoffTime?: string;
};

export type ParsedCancelledSlot = {
  date: string;
  time: string;
  imageIndex: number;
};

export type ParsedCastingChange = {
  date: string;
  time: string;
  role: string;
  actor: string;
  imageIndex: number;
};

export type ParsedCancelledEvent = {
  title: string;
  periodStart: string;
  periodEnd: string;
  imageIndex: number;
};

export type EventSource = "badge" | "notice";

// 코드 대조에 하나라도 실패했을 시 사용자 확인을 받는다
export type EventConfirmReason =
  | "range_badge"
  | "no_printed_weekday"
  | "overlaps_existing"
  | "has_slot_exceptions"
  | "has_specific_times"
  | "ambiguous_badge_time";

export const EVENT_CONFIRM_MESSAGE: Record<EventConfirmReason, string> = {
  range_badge: "캐스팅표 여백 라벨에서 읽어서 기간이 어긋날 수 있어요.",
  no_printed_weekday: "이미지에 요일이 없어 날짜를 다시 확인하지 못했어요.",
  overlaps_existing: "이미 등록된 이벤트와 기간이 겹쳐요.",
  has_slot_exceptions:
    "지정된 이벤트 기간 외 포함/제외 회차가 있어요. 원본과 대조해 확인해주세요.",
  has_specific_times:
    "기간 내 특정 시간 회차에만 적용돼요. 원본과 대조해 확인해주세요.",
  ambiguous_badge_time:
    "이날 회차가 여러 개인데 시간을 특정하지 못했어요. 어느 회차인지 원본과 대조해 확인해주세요.",
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
  includedSlots?: EventSlotException[];
  excludedSlots?: EventSlotException[];
  // 기간 내 특정 시간 회차에만 적용될 때. HH:mm
  exactTimes?: string[];
  listedSlots?: EventSlotException[];
  periodStartCutoffTime?: string;
  periodEndCutoffTime?: string;
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
  skipped: SkippedPerformance[];
  cancelledSlotCount: number;
  castingChangeCount: number;
  cancelledEventCount: number;
};
