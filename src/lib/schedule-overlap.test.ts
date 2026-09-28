import { describe, expect, it } from "vitest";

import { findOverlappingSlotIds } from "./schedule-overlap";

const slot = (id: number, date: string, time: string, showId: string) => ({
  id,
  date,
  time,
  showId,
});

describe("findOverlappingSlotIds", () => {
  it("들어온 회차 중 날짜와 시간이 겹치는 회차가 있을때 해당하는 회차들의 아이디를 반환한다", () => {
    const runtimeByShowId = { "1": 150, "2": 120, "3": 60 };

    expect(
      findOverlappingSlotIds(
        [
          slot(1, "2026-09-28", "12:00", "1"),
          slot(2, "2026-09-28", "11:30", "2"),
          slot(3, "2026-09-28", "19:30", "3"),
        ],
        runtimeByShowId,
      ),
    ).toStrictEqual(new Set([1, 2]));
  });

  it("시간이 같거나 겹치더라도 날짜가 겹치지 않는다면 아무것도 반환하지 않는다", () => {
    const runtimeByShowId = { "1": 150, "2": 120 };

    expect(
      findOverlappingSlotIds(
        [
          slot(1, "2026-09-27", "12:00", "1"),
          slot(2, "2026-09-28", "11:30", "2"),
        ],
        runtimeByShowId,
      ),
    ).toStrictEqual(new Set());
  });

  it("회차의 끝나는 시간과 다음 회차가 시작하는 시간이 동일한 경우에도 회차들의 아이디를 반환한다", () => {
    const runtimeByShowId = { "1": 60, "2": 120 };
    expect(
      findOverlappingSlotIds(
        [
          slot(1, "2026-09-28", "12:00", "1"),
          slot(2, "2026-09-28", "13:00", "2"),
        ],
        runtimeByShowId,
      ),
    ).toStrictEqual(new Set([1, 2]));
  });

  it("런타임이 없는 공연인 경우 DEFAULT_RUNTIME_MINUTES (default: 150) 런타임으로 계산된다", () => {
    expect(
      findOverlappingSlotIds(
        [
          slot(1, "2026-09-28", "12:00", "1"),
          slot(2, "2026-09-28", "14:30", "2"),
        ],
        {},
      ),
    ).toStrictEqual(new Set([1, 2]));

    expect(
      findOverlappingSlotIds(
        [
          slot(1, "2026-09-28", "12:00", "1"),
          slot(2, "2026-09-28", "14:31", "2"),
        ],
        {},
      ),
    ).toStrictEqual(new Set());
  });
});
