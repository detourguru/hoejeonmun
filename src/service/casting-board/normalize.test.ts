import { describe, expect, it } from "vitest";

import { ParsedDateTag } from "@/type/casting";

import { mergeWholeDayRuns } from "./normalize";

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

  it("이미 이어지는 날자의 배지도 끝나는 날 다음 날에 시작하는 배지와 합친다", () => {
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
