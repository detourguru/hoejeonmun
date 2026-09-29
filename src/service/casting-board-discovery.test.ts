import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hasCurrentOrFutureDate } from "./casting-board-discovery";

vi.mock("server-only", () => ({}));

describe("hasCurrentOrFutureDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 서울 기준 2026-09-28 12:00
    vi.setSystemTime(new Date("2026-09-28T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("오늘 공연이 하나라도 있으면 아직 쓸모 있는 캐스팅보드로 보고 저장한다", () => {
    expect(
      hasCurrentOrFutureDate([{ date: "2026-09-27" }, { date: "2026-09-28" }]),
    ).toBe(true);
  });

  it("앞으로 남은 공연이 있으면 저장한다", () => {
    expect(hasCurrentOrFutureDate([{ date: "2026-10-01" }])).toBe(true);
  });

  it("모든 회차가 지난 캐스팅보드는 KOPIS에 예전 이미지가 남아 있는 것이라 저장하지 않는다", () => {
    expect(
      hasCurrentOrFutureDate([{ date: "2026-09-01" }, { date: "2026-09-27" }]),
    ).toBe(false);
  });

  it("서버 시간(UTC)이 아니라 서울 날짜로 판단해서, 서울이 9/29 아침이면 UTC로는 아직 9/28이어도 9/28 공연은 지난 공연으로 본다", () => {
    // 서울 기준 2026-09-29 08:00, UTC로는 2026-09-28 23:00
    vi.setSystemTime(new Date("2026-09-28T23:00:00Z"));

    expect(hasCurrentOrFutureDate([{ date: "2026-09-28" }])).toBe(false);
    expect(hasCurrentOrFutureDate([{ date: "2026-09-29" }])).toBe(true);
  });
});
