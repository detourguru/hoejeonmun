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

  describe("배역 정보(roleByActor)가 있으면", () => {
    // 햄릿 역: 김배우/이배우(교대), 오필리아 역: 박배우
    const roleByActor = new Map([
      ["김배우", "햄릿"],
      ["이배우", "햄릿"],
      ["박배우", "오필리아"],
    ]);

    it("같은 배역 두 명을 고르면 한 명만 나와도 보여준다 (OR)", () => {
      const slot = { filterKeys: ["김배우", "박배우"] };

      expect(matchesActorFilter(slot, ["김배우", "이배우"], roleByActor)).toBe(
        true,
      );
    });

    it("다른 배역 두 명을 고르면 둘 다 나와야 보여준다 (AND)", () => {
      const together = { filterKeys: ["김배우", "박배우"] };
      const onlyOne = { filterKeys: ["이배우", "박배우"] };
      const neither = { filterKeys: ["김배우"] };

      expect(matchesActorFilter(together, ["이배우", "박배우"], roleByActor)).toBe(
        false,
      );
      expect(matchesActorFilter(onlyOne, ["이배우", "박배우"], roleByActor)).toBe(
        true,
      );
      expect(matchesActorFilter(neither, ["이배우", "박배우"], roleByActor)).toBe(
        false,
      );
    });

    it("같은 배역 두 명 + 다른 배역 한 명을 고르면 그 한 명과 짝지어진 회차를 모두 보여준다", () => {
      const withKim = { filterKeys: ["김배우", "박배우"] };
      const withLee = { filterKeys: ["이배우", "박배우"] };
      const withoutPark = { filterKeys: ["김배우"] };

      const actors = ["김배우", "이배우", "박배우"];

      expect(matchesActorFilter(withKim, actors, roleByActor)).toBe(true);
      expect(matchesActorFilter(withLee, actors, roleByActor)).toBe(true);
      expect(matchesActorFilter(withoutPark, actors, roleByActor)).toBe(false);
    });
  });
});
