import { describe, expect, it } from "vitest";

import { computeShowState } from "./show-state";

describe("computeShowState", () => {
  // 공연 기간 2026-09-01 ~ 2026-11-30
  const stateOn = (today: string) =>
    computeShowState("2026-09-01", "2026-11-30", today);

  it("첫 공연일 전이면 공연예정이다", () => {
    expect(stateOn("2026-08-31")).toBe("공연예정");
  });

  it.each([["2026-09-01"], ["2026-10-15"], ["2026-11-30"]])(
    "첫 공연일부터 마지막 공연일 당일까지는 공연중이다: %j",
    (today) => {
      expect(stateOn(today)).toBe("공연중");
    },
  );

  it("마지막 공연일이 지나면 공연중으로 남지 않고 공연종료로 보인다", () => {
    expect(stateOn("2026-12-01")).toBe("공연완료");
  });
});
