import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addDays,
  addMonths,
  findNearestDate,
  formatShortDate,
  getCalendarCells,
  getMonthRange,
  getWeekday,
  isIsoDate,
  normalizeDate,
  parseMonth,
  toInputDate,
  toIsoDate,
  toKopisDate,
  toMonth,
  getToday,
} from "./date";

const utc = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

describe("addMonths", () => {
  it("연도를 넘어가도 개월 수만큼 이동한다", () => {
    expect(toInputDate(addMonths(utc("2026-11-15"), 3))).toBe("2027-02-15");
    expect(toInputDate(addMonths(utc("2026-02-15"), -3))).toBe("2025-11-15");
  });

  it("원본 Date는 바꾸지 않는다", () => {
    const date = utc("2026-09-28");

    addMonths(date, 1);

    expect(toInputDate(date)).toBe("2026-09-28");
  });
});

describe("addDays", () => {
  it("월과 연도를 넘어가도 일 수만큼 이동한다", () => {
    expect(toInputDate(addDays(utc("2026-12-31"), 1))).toBe("2027-01-01");
    expect(toInputDate(addDays(utc("2026-03-01"), -1))).toBe("2026-02-28");
  });

  it("원본 Date는 바꾸지 않는다", () => {
    const date = utc("2026-09-28");

    addDays(date, 1);

    expect(toInputDate(date)).toBe("2026-09-28");
  });
});

describe("날짜 포맷 변환", () => {
  it("toKopisDate는 한 자리 월·일을 0으로 채운 YYYYMMDD로 바꾼다", () => {
    expect(toKopisDate(utc("2026-01-05"))).toBe("20260105");
  });

  it("toInputDate는 한 자리 월·일을 0으로 채운 YYYY-MM-DD로 바꾼다", () => {
    expect(toInputDate(utc("2026-01-05"))).toBe("2026-01-05");
  });

  it("toMonth는 YYYY-MM으로 바꾼다", () => {
    expect(toMonth(utc("2026-01-05"))).toBe("2026-01");
  });

  it.each<[string, "." | "", string]>([
    ["2026.09.28", "", "20260928"],
    ["2026-09-28", ".", "2026.09.28"],
  ])("normalizeDate(%j, %j) → %j", (value, option, expected) => {
    expect(normalizeDate(value, option)).toBe(expected);
  });

  it.each([["2026.09.28"], ["20260928"], ["2026-09-28"]])(
    "toIsoDate는 %j를 YYYY-MM-DD로 바꾼다",
    (value) => {
      expect(toIsoDate(value)).toBe("2026-09-28");
    },
  );
});

describe("isIsoDate", () => {
  it("YYYY-MM-DD 형식이면 true를 반환한다", () => {
    expect(isIsoDate("2026-09-28")).toBe(true);
  });

  it.each([["2026.09.28"], ["2026-9-28"], ["2026-09-28T00:00:00Z"]])(
    "구분자·자릿수가 다르거나 시각이 붙으면 false를 반환한다: %j",
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});

describe("parseMonth", () => {
  it("YYYY-MM을 그 달 1일(UTC)로 바꾼다", () => {
    expect(parseMonth("2026-09")).toStrictEqual(utc("2026-09-01"));
  });

  it.each([["2026-13"], ["2026-00"], ["2026-9"], ["2026-09-01"], [""]])(
    "형식이 맞지 않으면 null을 반환한다: %j",
    (value) => {
      expect(parseMonth(value)).toBeNull();
    },
  );
});

describe("getMonthRange", () => {
  it.each([
    ["2026-09-01", "2026-09-30"],
    ["2026-02-01", "2026-02-28"],
    ["2028-02-01", "2028-02-29"],
    ["2026-12-01", "2026-12-31"],
  ])("%s가 속한 달의 첫날과 마지막 날을 반환한다", (start, end) => {
    expect(getMonthRange(utc(start))).toStrictEqual({ start, end });
  });
});

describe("getCalendarCells", () => {
  it("1일의 요일만큼 앞을 null로 채우고 그 달의 모든 날짜를 이어 붙인다", () => {
    // 2026-09-01은 화요일이라 일·월 두 칸이 비어야 한다
    const cells = getCalendarCells(utc("2026-09-01"));

    expect(cells).toHaveLength(2 + 30);
    expect(cells.slice(0, 3)).toStrictEqual([null, null, "2026-09-01"]);
    expect(cells.at(-1)).toBe("2026-09-30");
  });

  it("1일이 일요일이면 빈칸 없이 시작한다", () => {
    const cells = getCalendarCells(utc("2026-02-01"));

    expect(cells[0]).toBe("2026-02-01");
    expect(cells).toHaveLength(28);
  });
});

describe("formatShortDate", () => {
  it("서울 기준 날짜로 표시한다", () => {
    // UTC로는 8/29 16:00이지만 서울은 8/30 01:00
    expect(formatShortDate("2026-08-29T16:00:00Z")).toBe("8월 30일");
  });
});

describe("getWeekday", () => {
  it.each([
    ["2026-09-27", "일"],
    ["2026-09-28", "월"],
    ["2026-10-03", "토"],
  ])("%s는 %s요일이다", (isoDate, expected) => {
    expect(getWeekday(isoDate)).toBe(expected);
  });
});

describe("getToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["2026-09-27T15:00:00Z", "2026-09-28T00:00:00Z"],
    ["2026-09-27T14:59:59Z", "2026-09-27T00:00:00Z"],
  ])(
    "항상 서울 기준 오늘 날짜 자정시간을 반환한다 %s → %s",
    (now, expected) => {
      vi.setSystemTime(new Date(now));
      expect(getToday()).toStrictEqual(new Date(expected));
    },
  );
});

describe("findNearestDate", () => {
  // 캘린더에서 일정이 있는 날짜들
  const filledDates = ["2026-09-05", "2026-09-20", "2026-09-25"];

  it("들어온 날짜에 일정이 있으면 그 날짜를 고른다", () => {
    expect(findNearestDate(filledDates, "2026-09-20")).toBe("2026-09-20");
  });

  it("들어온 날짜에 일정이 없으면 이번 달 첫 일정이 아니라 바로 다음 일정을 고른다", () => {
    expect(findNearestDate(filledDates, "2026-09-18")).toBe("2026-09-20");
  });

  it("들어온 날짜 뒤로 일정이 없으면 가장 최근에 지난 일정을 고른다", () => {
    expect(findNearestDate(filledDates, "2026-09-28")).toBe("2026-09-25");
  });

  it("일정이 하나도 없으면 아무 날짜도 고르지 않는다", () => {
    expect(findNearestDate([], "2026-09-28")).toBeNull();
  });
});
