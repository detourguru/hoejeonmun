import { normalizeActorName, splitActorNames } from "@/lib/actor-name";
import { addMonths, getToday, getWeekday, toInputDate, toIsoDate } from "@/lib/date";
import {
  EventConfirmReason,
  EventSlotException,
  EventSource,
  ExistingEvent,
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
  ParsedDateTag,
  ParsedEvent,
  ParsedPerformance,
  PendingEvent,
  PerformanceSkipReason,
  SkippedPerformance,
} from "@/type/casting";
import { ShowDetail } from "@/type/show";

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const slotKey = (date: string, time: string) => `${date} ${time.slice(0, 5)}`;

export function dedupeByKey<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = keyOf(item);

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export const PLACEHOLDER_NAMES = new Set(["", "-", "–", "—", "미정", "n/a", "N/A"]);

export const isPlaceholderActorName = (name: string) =>
  PLACEHOLDER_NAMES.has(name.trim().toLowerCase());

export const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

export const ENGLISH_WEEKDAYS: Record<string, string> = {
  sun: "일",
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
};

export const toKoreanWeekday = (printed: string) => {
  const value = printed.trim();

  if (value.length === 0) return "";

  return (
    ENGLISH_WEEKDAYS[value.slice(0, 3).toLowerCase()] ??
    value.replace(/요일$/, "")
  );
};

export const agreesWithPrintedWeekday = (isoDate: string, printed: string) =>
  printed.length === 0 || getWeekday(isoDate) === toKoreanWeekday(printed);

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const isNextDay = (date: string, next: string) =>
  Date.parse(`${next}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`) ===
  MS_PER_DAY;

export function resolveRunWindow(show: ShowDetail) {
  if (show.openrun !== "Y")
    return { from: toIsoDate(show.prfpdfrom), to: toIsoDate(show.prfpdto) };
  else
    return {
      from: toInputDate(addMonths(getToday(), -3)),
      to: toInputDate(addMonths(getToday(), 3)),
    };
}

export function parseCastNames(prfcast?: string): Set<string> {
  return new Set(splitActorNames(prfcast));
}

// 다른 공연의 캐스팅표가 섞여있는 이미지를 이미지 단위로 골라낸다
export function findCastMismatchImageIndexes(
  performances: ParsedPerformance[],
  show: ShowDetail,
): Set<number> {
  // 오픈런은 prfcast가 개막 당시 캐스팅이라 수년 지나면 지금 캐스팅과 안 겹칠 수 있어 대조 자체를 건너뛴다
  if (show.openrun === "Y") return new Set();

  const known = parseCastNames(show.prfcast);

  // 겹치는 이름이 하나도 없을 때 다른 공연의 캐스트로 판단
  if (known.size === 0) return new Set();

  const byImage = new Map<number, ParsedPerformance[]>();

  for (const performance of performances) {
    byImage.set(performance.imageIndex, [
      ...(byImage.get(performance.imageIndex) ?? []),
      performance,
    ]);
  }

  const mismatched = new Set<number>();

  for (const [imageIndex, group] of byImage) {
    const names = group.flatMap(({ casting }) => Object.values(casting).flat());

    if (!names.some((name) => known.has(normalizeName(name)))) {
      mismatched.add(imageIndex);
    }
  }

  return mismatched;
}

export function hasKnownCastOverlap(
  performances: ParsedPerformance[],
  show: ShowDetail,
) {
  return findCastMismatchImageIndexes(performances, show).size === 0;
}

export function skipReason(
  performance: ParsedPerformance,
  date: string,
  time: string,
  casting: Record<string, string[]>,
  key: string,
  seen: Set<string>,
  from: string,
  to: string,
  imageCount: number,
): PerformanceSkipReason | null {
  if (!DATE_PATTERN.test(date)) return "invalid_date";
  if (!TIME_PATTERN.test(time)) return "invalid_time";
  if (date < from || date > to) return "out_of_range";
  if (!agreesWithPrintedWeekday(date, performance.weekday ?? ""))
    return "weekday_mismatch";
  if (Object.keys(casting).length === 0) return "empty_casting";
  if (seen.has(key)) return "duplicate";

  if (
    !Number.isInteger(performance.imageIndex) ||
    performance.imageIndex < 0 ||
    performance.imageIndex >= imageCount
  ) {
    return "invalid_image_index";
  }

  return null;
}

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
export function normalizePerformances(
  performances: ParsedPerformance[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const seen = new Set<string>();
  const valid: ParsedPerformance[] = [];
  const skipped: SkippedPerformance[] = [];

  for (const performance of performances) {
    const date = performance.date?.trim() ?? "";
    const time = performance.time?.trim() ?? "";

    const casting = Object.fromEntries(
      Object.entries(performance.casting ?? {})
        .map(([role, actors]) => {
          const names = [
            ...new Set(
              (Array.isArray(actors) ? actors : [actors]).flatMap((actor) =>
                splitActorNames(String(actor ?? "")),
              ),
            ),
          ].filter((name) => !PLACEHOLDER_NAMES.has(name.toLowerCase()));

          return [normalizeName(role), names] as const;
        })
        .filter(([role, names]) => role && names.length > 0),
    );

    const key = slotKey(date, time);

    const reason = skipReason(
      performance,
      date,
      time,
      casting,
      key,
      seen,
      from,
      to,
      imageCount,
    );

    if (reason) {
      skipped.push({
        imageIndex: performance.imageIndex,
        raw: performance,
        reason,
      });
      continue;
    }

    seen.add(key);
    valid.push({
      date,
      time,
      weekday: performance.weekday,
      casting,
      imageIndex: performance.imageIndex,
      confidence: performance.confidence,
    });
  }

  const mismatchedImages = findCastMismatchImageIndexes(valid, show);

  // 완전히 걸러내지 않고 표시만 해서 검수 화면까지 보낸다 -- KOPIS prfcast는
  // 개막 시점 스냅샷이라 실제로는 맞는 캐스팅보드도 걸릴 수 있다
  const matched = valid.map((performance) =>
    mismatchedImages.has(performance.imageIndex)
      ? { ...performance, castMismatch: true }
      : performance,
  );

  return { performances: matched, skipped };
}

export function mergeSameDateTags(dateTags: ParsedDateTag[]): ParsedDateTag[] {
  const groups = new Map<string, ParsedDateTag[]>();

  for (const dateTag of dateTags) {
    const group = groups.get(dateTag.tag) ?? [];

    group.push(dateTag);
    groups.set(dateTag.tag, group);
  }

  const merged: ParsedDateTag[] = [];

  for (const group of groups.values()) {
    merged.push(
      ...mergeWholeDayRuns(group.filter((dateTag) => dateTag.time === "")),
    );
    merged.push(
      ...mergePerSlotRuns(group.filter((dateTag) => dateTag.time !== "")),
    );
  }

  return merged;
}

export function mergeWholeDayRuns(dateTags: ParsedDateTag[]): ParsedDateTag[] {
  if (dateTags.length === 0) return [];

  const merged: ParsedDateTag[] = [];

  const [first, ...rest] = dateTags.sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  let run = first;

  for (const dateTag of rest) {
    if (isNextDay(run.endDate, dateTag.startDate)) {
      run = {
        ...run,
        endDate: dateTag.endDate,
        printedEndWeekday: dateTag.printedEndWeekday,
      };
      continue;
    }

    merged.push(run);
    run = dateTag;
  }

  merged.push(run);

  return merged;
}

export function mergePerSlotRuns(dateTags: ParsedDateTag[]): ParsedDateTag[] {
  if (dateTags.length === 0) return [];

  const merged: ParsedDateTag[] = [];

  const sorted = dateTags.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) || a.time.localeCompare(b.time),
  );

  let run = [sorted[0]];

  const flushRun = () => {
    const [runFirst] = run;

    if (run.length === 1) {
      merged.push(runFirst);
      return;
    }

    const runLast = run[run.length - 1];

    merged.push({
      ...runFirst,
      endDate: runLast.startDate,
      printedEndWeekday: runLast.printedStartWeekday,
      time: "",
      slots: run.map(({ startDate, time }) => ({ date: startDate, time })),
    });
  };

  for (const dateTag of sorted.slice(1)) {
    const runEndDate = run[run.length - 1].startDate;

    if (
      dateTag.startDate !== runEndDate &&
      !isNextDay(runEndDate, dateTag.startDate)
    ) {
      flushRun();
      run = [dateTag];
      continue;
    }

    run.push(dateTag);
  }

  flushRun();

  return merged;
}

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
export function normalizeDateTags(
  dateTags: ParsedDateTag[],
  show: ShowDetail,
  imageCount: number,
  performances: ParsedPerformance[],
) {
  const { from, to } = resolveRunWindow(show);

  const valid: ParsedDateTag[] = [];

  for (const dateTag of dateTags) {
    const tag = dateTag.tag?.trim() ?? "";
    const startDate = dateTag.startDate?.trim() ?? "";
    const endDate = dateTag.endDate?.trim() ?? "";
    const printedStartWeekday = dateTag.printedStartWeekday?.trim() ?? "";
    const printedEndWeekday = dateTag.printedEndWeekday?.trim() ?? "";
    const time = dateTag.time?.trim() ?? "";

    const isValid =
      tag.length > 0 &&
      DATE_PATTERN.test(startDate) &&
      DATE_PATTERN.test(endDate) &&
      startDate <= endDate &&
      startDate >= from &&
      endDate <= to &&
      agreesWithPrintedWeekday(startDate, printedStartWeekday) &&
      agreesWithPrintedWeekday(endDate, printedEndWeekday) &&
      // 회차 하나에만 붙은 배지는 그 회차가 실제로 있어야 하고, 날짜 범위가 아니라 그 하루여야 한다
      (time === ""
        ? performances.some(({ date }) => date >= startDate && date <= endDate)
        : TIME_PATTERN.test(time) &&
          startDate === endDate &&
          performances.some(
            ({ date, time: pTime }) => date === startDate && pTime === time,
          )) &&
      Number.isInteger(dateTag.imageIndex) &&
      dateTag.imageIndex >= 0 &&
      dateTag.imageIndex < imageCount;

    if (!isValid) continue;

    valid.push({
      tag,
      startDate,
      endDate,
      printedStartWeekday,
      printedEndWeekday,
      time,
      imageIndex: dateTag.imageIndex,
    });
  }

  const deduped = dedupeByKey(
    valid,
    ({ startDate, endDate, tag, time }) =>
      `${startDate}~${endDate}::${tag}::${time}`,
  );

  return mergeSameDateTags(deduped);
}

export function unverifiedPoints(event: {
  source: EventSource;
  periodStart: string;
  periodEnd: string;
  printedStartWeekday: string;
  printedEndWeekday: string;
  includedSlots?: EventSlotException[];
  excludedSlots?: EventSlotException[];
  exactTimes?: string[];
  listedSlots?: EventSlotException[];
  periodStartCutoffTime?: string;
  periodEndCutoffTime?: string;
}): EventConfirmReason[] {
  const reasons: EventConfirmReason[] = [];

  if (event.source === "badge" && event.periodStart !== event.periodEnd) {
    reasons.push("range_badge");
  }

  if (!event.printedStartWeekday || !event.printedEndWeekday) {
    reasons.push("no_printed_weekday");
  } else if (
    !agreesWithPrintedWeekday(event.periodStart, event.printedStartWeekday) ||
    !agreesWithPrintedWeekday(event.periodEnd, event.printedEndWeekday)
  ) {
    reasons.push("weekday_mismatch");
  }

  if (
    event.includedSlots?.length ||
    event.excludedSlots?.length ||
    event.listedSlots?.length ||
    event.periodStartCutoffTime ||
    event.periodEndCutoffTime
  ) {
    reasons.push("has_slot_exceptions");
  }

  if (event.exactTimes?.length) {
    reasons.push("has_specific_times");
  }

  return reasons;
}

export function toPendingEvents(
  dateTags: ParsedDateTag[],
  events: ParsedEvent[],
): PendingEvent[] {
  const fromNotices = events.map(
    ({
      title,
      description,
      periodStart,
      periodEnd,
      printedStartWeekday,
      printedEndWeekday,
      imageIndex,
      includedSlots,
      excludedSlots,
      exactTimes,
      listedSlots,
      periodStartCutoffTime,
      periodEndCutoffTime,
    }) => ({
      title,
      description,
      periodStart,
      periodEnd,
      printedStartWeekday,
      printedEndWeekday,
      imageIndex,
      includedSlots,
      excludedSlots,
      exactTimes,
      listedSlots,
      periodStartCutoffTime,
      periodEndCutoffTime,
      source: "notice" as const,
    }),
  );

  const fromBadges = dateTags.map(
    ({ tag, startDate, endDate, time, slots, ...dateTag }) => ({
      ...dateTag,
      title: tag,
      periodStart: startDate,
      periodEnd: endDate,
      // 회차 하나에만 붙은 배지는 그 회차에만 적용되게 exactTimes로 좁힌다
      exactTimes: !slots && time ? [time] : undefined,
      listedSlots: slots,
      source: "badge" as const,
    }),
  );

  return [...fromNotices, ...fromBadges].map((event) => ({
    ...event,
    confirmReasons: unverifiedPoints(event),
    overlapping: [],
  }));
}

export const toExistingEvent = (row: {
  id: number;
  title: string;
  period_start: string;
  period_end: string;
  source: EventSource;
  edited: boolean;
  group_id: number;
}): ExistingEvent => ({
  id: row.id,
  title: row.title,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  source: row.source,
  edited: row.edited,
  groupId: row.group_id,
});

export const PUNCT_PATTERN = /[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~·・]/g;

// events.title_key 생성 규칙과 동일하게 공백/문장부호를 지운 키로 대조한다.
export const toTitleKey = (title: string) =>
  title.trim().toLowerCase().replace(/\s+/g, "").replace(PUNCT_PATTERN, "");

export const isExactSameEvent = (
  event: Pick<PendingEvent, "title" | "periodStart" | "periodEnd">,
  candidate: ExistingEvent,
) =>
  !candidate.edited &&
  event.periodStart === candidate.periodStart &&
  event.periodEnd === candidate.periodEnd &&
  toTitleKey(event.title) === toTitleKey(candidate.title);
export const sanitizeSlotExceptions = (
  slots: EventSlotException[] | undefined,
): EventSlotException[] | undefined => {
  if (!slots) return undefined;

  const cleaned = slots.filter(
    ({ date, time }) => DATE_PATTERN.test(date) && TIME_PATTERN.test(time),
  );

  return cleaned.length > 0 ? cleaned : undefined;
};

export const sanitizeExactTimes = (
  times: string[] | undefined,
): string[] | undefined => {
  if (!times) return undefined;

  const cleaned = [...new Set(times.filter((time) => TIME_PATTERN.test(time)))];

  return cleaned.length > 0 ? cleaned : undefined;
};

export const sanitizeCutoffTime = (time: string | undefined): string | undefined => {
  const trimmed = time?.trim() ?? "";

  return TIME_PATTERN.test(trimmed) ? trimmed : undefined;
};

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
export function normalizeEvents(
  events: ParsedEvent[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const valid: ParsedEvent[] = [];

  for (const event of events) {
    const title = event.title?.trim() ?? "";
    const periodStart = event.periodStart?.trim() ?? "";
    const periodEnd = event.periodEnd?.trim() ?? "";
    const printedStartWeekday = event.printedStartWeekday?.trim() ?? "";
    const printedEndWeekday = event.printedEndWeekday?.trim() ?? "";
    const description = event.description?.trim() || undefined;

    const isValid =
      title.length > 0 &&
      DATE_PATTERN.test(periodStart) &&
      DATE_PATTERN.test(periodEnd) &&
      periodStart <= periodEnd &&
      // 공연 기간과 아예 안 겹치는 이벤트는 다른 공연 것으로 판단
      periodStart <= to &&
      periodEnd >= from &&
      // 요일 오탈자일 수 있으니 여기서 버리지 않고 unverifiedPoints에서 확인 요청으로 남긴다
      Number.isInteger(event.imageIndex) &&
      event.imageIndex >= 0 &&
      event.imageIndex < imageCount;

    if (!isValid) continue;

    valid.push({
      title,
      description,
      periodStart,
      periodEnd,
      printedStartWeekday,
      printedEndWeekday,
      imageIndex: event.imageIndex,
      includedSlots: sanitizeSlotExceptions(event.includedSlots),
      excludedSlots: sanitizeSlotExceptions(event.excludedSlots),
      exactTimes: sanitizeExactTimes(event.exactTimes),
      listedSlots: sanitizeSlotExceptions(event.listedSlots),
      periodStartCutoffTime: sanitizeCutoffTime(event.periodStartCutoffTime),
      periodEndCutoffTime: sanitizeCutoffTime(event.periodEndCutoffTime),
    });
  }

  return dedupeByKey(
    valid,
    ({ title, periodStart, periodEnd }) =>
      `${toTitleKey(title)} ${periodStart} ${periodEnd}`,
  );
}

export function normalizeCancelledSlots(
  slots: ParsedCancelledSlot[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const valid: ParsedCancelledSlot[] = [];

  for (const slot of slots) {
    const date = slot.date?.trim() ?? "";
    const time = slot.time?.trim() ?? "";

    const isValid =
      DATE_PATTERN.test(date) &&
      TIME_PATTERN.test(time) &&
      date >= from &&
      date <= to &&
      Number.isInteger(slot.imageIndex) &&
      slot.imageIndex >= 0 &&
      slot.imageIndex < imageCount;

    if (!isValid) continue;

    valid.push({ date, time, imageIndex: slot.imageIndex });
  }

  return dedupeByKey(valid, ({ date, time }) => slotKey(date, time));
}

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
export function normalizeCastingChanges(
  changes: ParsedCastingChange[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const valid: ParsedCastingChange[] = [];

  for (const change of changes) {
    const date = change.date?.trim() ?? "";
    const time = change.time?.trim() ?? "";
    const role = normalizeName(change.role ?? "");
    const actor = normalizeActorName(change.actor ?? "");

    const isValid =
      DATE_PATTERN.test(date) &&
      TIME_PATTERN.test(time) &&
      date >= from &&
      date <= to &&
      role.length > 0 &&
      actor.length > 0 &&
      !PLACEHOLDER_NAMES.has(actor.toLowerCase()) &&
      Number.isInteger(change.imageIndex) &&
      change.imageIndex >= 0 &&
      change.imageIndex < imageCount;

    if (!isValid) continue;

    valid.push({ date, time, role, actor, imageIndex: change.imageIndex });
  }

  return dedupeByKey(
    valid,
    ({ date, time, role }) => `${slotKey(date, time)} ${role}`,
  );
}

// Gemini 응답의 값을 보장하기 위해 여기서 한 번 더 거른다
export function normalizeCancelledEvents(
  events: ParsedCancelledEvent[],
  show: ShowDetail,
  imageCount: number,
) {
  const { from, to } = resolveRunWindow(show);

  const valid: ParsedCancelledEvent[] = [];

  for (const event of events) {
    const title = event.title?.trim() ?? "";
    const periodStart = event.periodStart?.trim() ?? "";
    const periodEnd = event.periodEnd?.trim() ?? "";

    const isValid =
      title.length > 0 &&
      DATE_PATTERN.test(periodStart) &&
      DATE_PATTERN.test(periodEnd) &&
      periodStart <= periodEnd &&
      periodStart <= to &&
      periodEnd >= from &&
      Number.isInteger(event.imageIndex) &&
      event.imageIndex >= 0 &&
      event.imageIndex < imageCount;

    if (!isValid) continue;

    valid.push({ title, periodStart, periodEnd, imageIndex: event.imageIndex });
  }

  return dedupeByKey(
    valid,
    ({ title, periodStart, periodEnd }) =>
      `${toTitleKey(title)} ${periodStart} ${periodEnd}`,
  );
}

