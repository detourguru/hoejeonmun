import { describe, expect, it } from "vitest";

import { matchesActorFilter } from "./actor-filter";

describe("matchesActorFilter", () => {
  // 한 회차에 나오는 배우들
  const slot = { filterKeys: ["김배우", "이배우"] };

  it("배우를 하나도 고르지 않으면 모든 회차의 캐스팅을 보여준다", () => {
    expect(matchesActorFilter(slot, [])).toBe(true);
  });

  it("고른 배우 중 한 명만 나와도 그 회차를 보여준다 (페어가 모두 나와야 하는 조건이 아니다)", () => {
    expect(matchesActorFilter(slot, ["김배우", "박배우"])).toBe(true);
  });

  it("고른 배우가 아무도 나오지 않는 회차는 숨긴다", () => {
    expect(matchesActorFilter(slot, ["박배우"])).toBe(false);
  });

  it("캐스팅 정보가 없는 회차(내 공연 등)는 배우를 골라도 숨기지 않는다", () => {
    expect(matchesActorFilter({}, ["박배우"])).toBe(true);
  });
});
