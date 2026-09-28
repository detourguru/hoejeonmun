import { describe, expect, it } from "vitest";

import { ParsedDateTag } from "@/type/casting";

import {
  agreesWithPrintedWeekday,
  isNextDay,
  mergePerSlotRuns,
  mergeSameDateTags,
  mergeWholeDayRuns,
  toKoreanWeekday,
} from "./normalize";

const dateTag = (
  tag: string,
  startDate: string,
  endDate: string,
  overrides: Partial<ParsedDateTag> = {},
): ParsedDateTag => ({
  tag,
  startDate,
  endDate,
  printedStartWeekday: "",
  printedEndWeekday: "",
  time: "",
  imageIndex: 1,
  ...overrides,
});

describe("mergeWholeDayRuns", () => {
  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(mergeWholeDayRuns([])).toStrictEqual([]);
  });

  it("순서가 섞여 있어도 연속된 날짜는 하나의 기간으로 합치고 떨어진 날짜는 따로 둔다", () => {
    expect(
      mergeWholeDayRuns([
        dateTag("프리뷰", "2026-09-03", "2026-09-03"),
        dateTag("프리뷰", "2026-09-01", "2026-09-01"),
        dateTag("프리뷰", "2026-09-02", "2026-09-02"),
        dateTag("프리뷰", "2026-09-05", "2026-09-05"),
      ]),
    ).toStrictEqual([
      dateTag("프리뷰", "2026-09-01", "2026-09-03"),
      dateTag("프리뷰", "2026-09-05", "2026-09-05"),
    ]);
  });

  it("여러 날에 걸친 배지도 끝나는 날 다음 날에 시작하는 배지와 합친다", () => {
    expect(
      mergeWholeDayRuns([
        dateTag("프리뷰", "2026-09-01", "2026-09-02"),
        dateTag("프리뷰", "2026-09-03", "2026-09-04"),
      ]),
    ).toStrictEqual([dateTag("프리뷰", "2026-09-01", "2026-09-04")]);
  });

  it("월이 바뀌어도 연속된 날짜면 합친다", () => {
    expect(
      mergeWholeDayRuns([
        dateTag("막공 주간", "2026-09-30", "2026-09-30"),
        dateTag("막공 주간", "2026-10-01", "2026-10-01"),
      ]),
    ).toStrictEqual([dateTag("막공 주간", "2026-09-30", "2026-10-01")]);
  });

  it("합친 기간은 첫 배지의 정보를 유지하고 끝 요일만 마지막 배지의 것으로 바꾼다", () => {
    expect(
      mergeWholeDayRuns([
        dateTag("프리뷰", "2026-09-01", "2026-09-01", {
          printedStartWeekday: "화",
          printedEndWeekday: "화",
          imageIndex: 0,
        }),
        dateTag("프리뷰", "2026-09-02", "2026-09-02", {
          printedStartWeekday: "수",
          printedEndWeekday: "수",
          imageIndex: 1,
        }),
      ]),
    ).toStrictEqual([
      dateTag("프리뷰", "2026-09-01", "2026-09-02", {
        printedStartWeekday: "화",
        printedEndWeekday: "수",
        imageIndex: 0,
      }),
    ]);
  });
});

describe("mergePerSlotRuns", () => {
  const slotTag = (
    date: string,
    time: string,
    overrides: Partial<ParsedDateTag> = {},
  ) => dateTag("커튼콜데이", date, date, { time, ...overrides });

  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(mergePerSlotRuns([])).toStrictEqual([]);
  });

  it("한 회차에만 붙은 배지는 합칠 대상이 없으면 회차 시각을 유지한 채 그대로 둔다", () => {
    expect(mergePerSlotRuns([slotTag("2026-09-01", "19:30")])).toStrictEqual([
      slotTag("2026-09-01", "19:30"),
    ]);
  });

  it("같은 날 여러 회차에 붙은 배지는 하나로 합치고, 적용 회차를 slots에 남긴다", () => {
    expect(
      mergePerSlotRuns([
        slotTag("2026-09-01", "19:30"),
        slotTag("2026-09-01", "14:00"),
      ]),
    ).toStrictEqual([
      dateTag("커튼콜데이", "2026-09-01", "2026-09-01", {
        slots: [
          { date: "2026-09-01", time: "14:00" },
          { date: "2026-09-01", time: "19:30" },
        ],
      }),
    ]);
  });

  it("연속된 날짜의 여러 회차에 붙은 배지는 하나의 기간으로 합치고, 적용 회차를 날짜/시각 순으로 slots에 남긴다", () => {
    expect(
      mergePerSlotRuns([
        slotTag("2026-09-02", "19:30"),
        slotTag("2026-09-01", "19:30"),
        slotTag("2026-09-02", "14:00"),
      ]),
    ).toStrictEqual([
      dateTag("커튼콜데이", "2026-09-01", "2026-09-02", {
        slots: [
          { date: "2026-09-01", time: "19:30" },
          { date: "2026-09-02", time: "14:00" },
          { date: "2026-09-02", time: "19:30" },
        ],
      }),
    ]);
  });

  it("날짜가 떨어진 회차의 배지는 합치지 않고, 혼자 남은 배지는 회차 시각을 유지한다", () => {
    expect(
      mergePerSlotRuns([
        slotTag("2026-09-01", "14:00"),
        slotTag("2026-09-01", "19:30"),
        slotTag("2026-09-05", "19:30"),
      ]),
    ).toStrictEqual([
      dateTag("커튼콜데이", "2026-09-01", "2026-09-01", {
        slots: [
          { date: "2026-09-01", time: "14:00" },
          { date: "2026-09-01", time: "19:30" },
        ],
      }),
      slotTag("2026-09-05", "19:30"),
    ]);
  });

  it("회차 배지를 합치면 첫 배지의 정보를 유지하고, 끝 요일은 마지막 회차 날짜의 요일로 채운다", () => {
    expect(
      mergePerSlotRuns([
        slotTag("2026-09-01", "19:30", {
          printedStartWeekday: "화",
          printedEndWeekday: "화",
          imageIndex: 0,
        }),
        slotTag("2026-09-02", "19:30", {
          printedStartWeekday: "수",
          printedEndWeekday: "",
          imageIndex: 1,
        }),
      ]),
    ).toStrictEqual([
      dateTag("커튼콜데이", "2026-09-01", "2026-09-02", {
        printedStartWeekday: "화",
        printedEndWeekday: "수",
        imageIndex: 0,
        slots: [
          { date: "2026-09-01", time: "19:30" },
          { date: "2026-09-02", time: "19:30" },
        ],
      }),
    ]);
  });
});

describe("mergeSameDateTags", () => {
  it("종류가 다른 배지는 날짜가 이어져도 합치지 않는다", () => {
    const result = mergeSameDateTags([
      dateTag("프리뷰", "2026-09-01", "2026-09-01"),
      dateTag("커튼콜데이", "2026-09-02", "2026-09-02"),
    ]);

    expect(result).toHaveLength(2);
    expect(result).toStrictEqual(
      expect.arrayContaining([
        dateTag("프리뷰", "2026-09-01", "2026-09-01"),
        dateTag("커튼콜데이", "2026-09-02", "2026-09-02"),
      ]),
    );
  });

  it("같은 종류라도 하루 전체 배지와 회차 배지는 서로 합치지 않는다", () => {
    const result = mergeSameDateTags([
      dateTag("프리뷰", "2026-09-01", "2026-09-01"),
      dateTag("프리뷰", "2026-09-02", "2026-09-02", { time: "19:30" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result).toStrictEqual(
      expect.arrayContaining([
        dateTag("프리뷰", "2026-09-01", "2026-09-01"),
        dateTag("프리뷰", "2026-09-02", "2026-09-02", { time: "19:30" }),
      ]),
    );
  });

  it("같은 종류의 배지는 하루 전체 배지끼리, 회차 배지끼리 각각 합친다", () => {
    const result = mergeSameDateTags([
      dateTag("프리뷰", "2026-09-01", "2026-09-01"),
      dateTag("프리뷰", "2026-09-02", "2026-09-02"),
      dateTag("프리뷰", "2026-09-10", "2026-09-10", { time: "14:00" }),
      dateTag("프리뷰", "2026-09-10", "2026-09-10", { time: "19:30" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result).toStrictEqual(
      expect.arrayContaining([
        dateTag("프리뷰", "2026-09-01", "2026-09-02"),
        dateTag("프리뷰", "2026-09-10", "2026-09-10", {
          slots: [
            { date: "2026-09-10", time: "14:00" },
            { date: "2026-09-10", time: "19:30" },
          ],
        }),
      ]),
    );
  });
});

describe("toKoreanWeekday", () => {
  it.each([["MON"], ["Mon."], ["monday"], ["월요일"], ["월"], [" 월 "]])(
    "영문/한글 표기와 상관없이 한 글자 한글 요일로 바꾼다: %j",
    (printed) => {
      expect(toKoreanWeekday(printed)).toBe("월");
    },
  );

  it.each([[""], ["  "]])(
    "요일이 적혀 있지 않으면 빈 문자열을 반환한다: %j",
    (printed) => {
      expect(toKoreanWeekday(printed)).toBe("");
    },
  );
});

describe("agreesWithPrintedWeekday", () => {
  // 2026-09-28은 월요일
  it.each([["월"], ["MON"], ["월요일"]])(
    "캐스팅보드에 적힌 요일이 실제 요일과 같으면 true를 반환한다: %j",
    (printed) => {
      expect(agreesWithPrintedWeekday("2026-09-28", printed)).toBe(true);
    },
  );

  it("캐스팅보드에 적힌 요일이 실제 요일과 다르면 false를 반환한다", () => {
    expect(agreesWithPrintedWeekday("2026-09-28", "화")).toBe(false);
  });

  it("요일이 적혀 있지 않으면 대조할 수 없으니 true를 반환한다", () => {
    expect(agreesWithPrintedWeekday("2026-09-28", "")).toBe(true);
  });
});

describe("isNextDay", () => {
  it.each([
    ["2026-09-28", "2026-09-29"],
    ["2026-09-30", "2026-10-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29"],
  ])(
    "월/연도가 바뀌어도 바로 다음 날이면 true를 반환한다: %s → %s",
    (date, next) => {
      expect(isNextDay(date, next)).toBe(true);
    },
  );

  it.each([
    ["2026-09-28", "2026-09-28"],
    ["2026-09-28", "2026-09-30"],
    ["2026-09-29", "2026-09-28"],
  ])("같은 날, 이틀 뒤, 전날은 false를 반환한다: %s → %s", (date, next) => {
    expect(isNextDay(date, next)).toBe(false);
  });
});
