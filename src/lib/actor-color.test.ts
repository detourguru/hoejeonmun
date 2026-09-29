import { describe, expect, it } from "vitest";

import { getActorColorMap } from "./actor-color";

describe("getActorColorMap", () => {
  it("애정배우가 12명까지는 배우 id와 상관없이 모두 다른 색을 받아 캘린더에서 구분된다", () => {
    const ids = [1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81, 89];

    const colors = new Set(getActorColorMap(ids).values());

    expect(colors.size).toBe(ids.length);
  });

  it("같은 배우가 여러 번 들어와도 한 색만 차지해서 다른 배우와 색이 겹치지 않는다", () => {
    const colorById = getActorColorMap([1, 1, 2]);

    expect(colorById.size).toBe(2);
    expect(colorById.get(1)).not.toBe(colorById.get(2));
  });

  it("공연 id처럼 문자열 id를 넘겨도 각 공연마다 다른 색을 받는다", () => {
    const colorByShowId = getActorColorMap(["PF001", "PF002", "PF001"]);

    expect(colorByShowId.size).toBe(2);
    expect(colorByShowId.get("PF001")).not.toBe(colorByShowId.get("PF002"));
  });
});
