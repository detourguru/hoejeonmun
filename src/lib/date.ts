/**
 * vercel 서버 타임존과 한국 타임존이 상이해 서울 기준 날짜를 구해주기 위한 헬퍼
 * 시간은 구할 수 없다
 */

const TIME_ZONE = "Asia/Seoul";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getToday(): Date {
  const parts = formatter.formatToParts(new Date());

  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return new Date(
    Date.UTC(valueOf("year"), valueOf("month") - 1, valueOf("day")),
  );
}

export function addMonths(date: Date, months: number): Date {
  const moved = new Date(date);

  moved.setUTCMonth(moved.getUTCMonth() + months);

  return moved;
}

function toParts(date: Date) {
  return [
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ];
}

// YYYYMMDD
export function toKopisDate(date: Date): string {
  return toParts(date).join("");
}

// YYYY-MM-DD
export function toInputDate(date: Date): string {
  return toParts(date).join("-");
}

// 여러 날짜 타입을 정규화
export function normalizeDate(value: string, option: "." | ""): string {
  return value.replace(/\D/g, option);
}

// KOPIS의 YYYY.MM.DD -> YYYY-MM-DD
export function toIsoDate(value: string): string {
  const digits = normalizeDate(value, "");

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// YYYY-MM
export function toMonth(date: Date): string {
  const [year, month] = toParts(date);

  return `${year}-${month}`;
}

// YYYY-MM -> 그 달 1일
export function parseMonth(value: string): Date | null {
  const matched = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);

  if (!matched) return null;

  return new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, 1));
}

export function getMonthRange(month: Date) {
  const year = month.getUTCFullYear();
  const index = month.getUTCMonth();

  return {
    start: toInputDate(new Date(Date.UTC(year, index, 1))),
    end: toInputDate(new Date(Date.UTC(year, index + 1, 0))),
  };
}

// null이면 빈칸 / 아니면 YYYY-MM-DD
export function getCalendarCells(month: Date): (string | null)[] {
  const year = month.getUTCFullYear();
  const index = month.getUTCMonth();

  const firstWeekday = new Date(Date.UTC(year, index, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();

  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: lastDate }, (_, day) =>
      toInputDate(new Date(Date.UTC(year, index, day + 1))),
    ),
  ];
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

// 날짜만 있으면 타임존과 무관하므로 UTC로 계산한다
export function getWeekday(isoDate: string): string {
  return WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
}
