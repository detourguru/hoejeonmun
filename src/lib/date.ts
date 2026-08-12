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

// 여러 날짜 타입을 YYYYMMDD로 정규화
export function normalizeDate(value: string): string {
  return value.replace(/\D/g, "");
}
