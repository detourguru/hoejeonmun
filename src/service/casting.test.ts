import { describe, expect, it, vi } from "vitest";

import { getPairKey, groupByDate } from "./casting";

vi.mock("server-only", () => ({}));

describe("getPairKey", () => {
  it("캐스팅표 앞 두 열의 배우를 주연 페어로 묶어 표시한다", () => {
    expect(getPairKey(["정휘", "김철수", "박영희", "이민수"])).toBe(
      "정휘·김철수",
    );
  });

  it("배우가 한 명뿐이면 그 배우만 표시한다", () => {
    expect(getPairKey(["정휘"])).toBe("정휘");
  });
});

describe("groupByDate", () => {
  it("같은 날짜의 항목끼리 들어온 순서대로 묶는다", () => {
    const grouped = groupByDate([
      { date: "2026-09-28", time: "19:30" },
      { date: "2026-09-29", time: "14:00" },
      { date: "2026-09-28", time: "14:00" },
    ]);

    expect([...grouped.entries()]).toStrictEqual([
      [
        "2026-09-28",
        [
          { date: "2026-09-28", time: "19:30" },
          { date: "2026-09-28", time: "14:00" },
        ],
      ],
      ["2026-09-29", [{ date: "2026-09-29", time: "14:00" }]],
    ]);
  });
});
