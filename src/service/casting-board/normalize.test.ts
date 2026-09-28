import { describe, expect, it } from "vitest";

import { ParsedDateTag } from "@/type/casting";

import { mergePerSlotRuns, mergeWholeDayRuns } from "./normalize";

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
