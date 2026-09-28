import { describe, expect, it } from "vitest";

import { mergeKnownSlots } from "./known-slots";

describe("mergeKnownSlots", () => {
  it("이미 등록된 회차와 이번 업로드에서 입력한 회차를 모두 이벤트 적용 회차 후보로 보여준다", () => {
    expect(
      mergeKnownSlots(
        [{ date: "2026-09-28", time: "19:30:00" }],
        [{ date: "2026-09-29", time: "14:00" }],
      ),
    ).toStrictEqual([
      { date: "2026-09-28", time: "19:30" },
      { date: "2026-09-29", time: "14:00" },
    ]);
  });

  it("초 단위까지 적힌 등록 회차와 이번에 입력한 회차가 같은 시각이면 한 번만 보여준다", () => {
    expect(
      mergeKnownSlots(
        [{ date: "2026-09-28", time: "19:30:00" }],
        [{ date: "2026-09-28", time: "19:30" }],
      ),
    ).toStrictEqual([{ date: "2026-09-28", time: "19:30" }]);
  });
});
