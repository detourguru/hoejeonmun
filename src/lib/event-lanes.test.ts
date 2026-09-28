import { describe, expect, it } from "vitest";

import { assignEventLanes } from "./event-lanes";

// span: 한 주(0=일 ~ 6=토) 안에서 이벤트가 걸친 칸
const event = (
  id: number,
  periodStart: string,
  periodEnd: string,
  span: number[],
) => ({ id, periodStart, periodEnd, span });

describe("assignEventLanes", () => {
  it("같은 날짜에 걸친 이벤트들은 서로 다른 줄에 놓아 캘린더 라벨이 겹치지 않는다", () => {
    const { laneOf, laneCount } = assignEventLanes([
      event(1, "2026-09-27", "2026-09-30", [0, 1, 2, 3]),
      event(2, "2026-09-29", "2026-10-01", [2, 3, 4]),
    ]);

    expect(laneOf.get(1)).not.toBe(laneOf.get(2));
    expect(laneCount).toBe(2);
  });

  it("날짜가 겹치지 않는 이벤트끼리는 같은 줄을 같이 써서 칸 높이를 아낀다", () => {
    const { laneOf, laneCount } = assignEventLanes([
      event(1, "2026-09-27", "2026-09-28", [0, 1]),
      event(2, "2026-09-30", "2026-10-01", [3, 4]),
    ]);

    expect(laneOf.get(1)).toBe(laneOf.get(2));
    expect(laneCount).toBe(1);
  });

  it("먼저 시작하는 이벤트가 위 줄에 온다 (들어온 순서와 상관없다)", () => {
    const { laneOf } = assignEventLanes([
      event(2, "2026-09-29", "2026-09-29", [2]),
      event(1, "2026-09-27", "2026-09-30", [0, 1, 2, 3]),
    ]);

    expect(laneOf.get(1)).toBe(0);
    expect(laneOf.get(2)).toBe(1);
  });

  it("같은 날 시작하면 더 길게 이어지는 이벤트가 위 줄에 온다", () => {
    const { laneOf } = assignEventLanes([
      event(1, "2026-09-27", "2026-09-27", [0]),
      event(2, "2026-09-27", "2026-10-03", [0, 1, 2, 3, 4, 5, 6]),
    ]);

    expect(laneOf.get(2)).toBe(0);
    expect(laneOf.get(1)).toBe(1);
  });
});
