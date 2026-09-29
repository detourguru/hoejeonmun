import { describe, expect, it } from "vitest";

import { createActorFilter, getRolesByActor } from "./actor-filter";

describe("createActorFilter", () => {
  it.each([undefined, []])(
    "배역이 없는 배우(%j)는 독립 조건으로 검사한다",
    (roles) => {
      const byActor = new Map<string, string[]>([["김배우", ["햄릿"]]]);
      if (roles) byActor.set("이배우", roles);
      const matches = createActorFilter(["김배우", "이배우"], byActor);
      expect(matches({ filterKeys: ["김배우"] })).toBe(false);
      expect(matches({ filterKeys: ["김배우", "이배우"] })).toBe(true);
    },
  );
  // 한 회차에 나오는 배우들
  const slot = { filterKeys: ["김배우", "이배우"] };

  it("배우를 하나도 고르지 않으면 모든 회차의 캐스팅을 보여준다", () => {
    expect(createActorFilter([])(slot)).toBe(true);
  });

  it("고른 배우 중 한 명만 나와도 그 회차를 보여준다 (페어가 모두 나와야 하는 조건이 아니다)", () => {
    expect(createActorFilter(["김배우", "박배우"])(slot)).toBe(true);
  });

  it("고른 배우가 아무도 나오지 않는 회차는 숨긴다", () => {
    expect(createActorFilter(["박배우"])(slot)).toBe(false);
  });

  it("캐스팅 정보가 없는 회차(내 공연 등)는 배우를 골라도 숨기지 않는다", () => {
    expect(createActorFilter(["박배우"])({})).toBe(true);
  });

  describe("배역 정보(rolesByActor)가 있으면", () => {
    // 햄릿 역: 김배우/이배우(교대), 오필리아 역: 박배우
    const rolesByActor = getRolesByActor([
      { actor: "김배우", role: "햄릿" },
      { actor: "이배우", role: "햄릿" },
      { actor: "박배우", role: "오필리아" },
    ]);

    it("같은 배역 두 명을 고르면 한 명만 나와도 보여준다 (OR)", () => {
      const slot = { filterKeys: ["김배우", "박배우"] };

      expect(createActorFilter(["김배우", "이배우"], rolesByActor)(slot)).toBe(
        true,
      );
    });

    it("다른 배역 두 명을 고르면 둘 다 나와야 보여준다 (AND)", () => {
      const together = { filterKeys: ["김배우", "박배우"] };
      const onlyOne = { filterKeys: ["이배우", "박배우"] };
      const neither = { filterKeys: ["김배우"] };

      expect(
        createActorFilter(["이배우", "박배우"], rolesByActor)(together),
      ).toBe(false);
      expect(
        createActorFilter(["이배우", "박배우"], rolesByActor)(onlyOne),
      ).toBe(true);
      expect(
        createActorFilter(["이배우", "박배우"], rolesByActor)(neither),
      ).toBe(false);
    });

    it("같은 배역 두 명 + 다른 배역 한 명을 고르면 그 한 명과 짝지어진 회차를 모두 보여준다", () => {
      const withKim = { filterKeys: ["김배우", "박배우"] };
      const withLee = { filterKeys: ["이배우", "박배우"] };
      const withoutPark = { filterKeys: ["김배우"] };

      const actors = ["김배우", "이배우", "박배우"];
      const matchesActorFilter = createActorFilter(actors, rolesByActor);

      expect(
        [withKim, withLee, withoutPark].filter(matchesActorFilter),
      ).toEqual([withKim, withLee]);
    });
  });

  it("복수 배역 배우의 두 번째 배역도 필터 조건에 반영한다", () => {
    const rolesByActor = getRolesByActor([
      { actor: "김배우", role: "햄릿" },
      { actor: "이배우", role: "햄릿" },
      { actor: "김배우", role: "오필리아" },
    ]);

    expect(
      createActorFilter(
        ["김배우", "이배우"],
        rolesByActor,
      )({ filterKeys: ["이배우"] }),
    ).toBe(false);
    expect(
      createActorFilter(
        ["김배우", "이배우"],
        rolesByActor,
      )({ filterKeys: ["김배우", "이배우"] }),
    ).toBe(true);
    expect(
      createActorFilter(["김배우"], rolesByActor)({ filterKeys: ["김배우"] }),
    ).toBe(true);
  });
});

describe("getRolesByActor", () => {
  it("한 배우가 여러 배역을 맡았을 때 모두 보존한다", () => {
    const rows = [
      { actor: "김배우", role: "햄릿" },
      { actor: "이배우", role: "햄릿" },
      { actor: "김배우", role: "오필리아" },
    ];

    const rolesByActor = getRolesByActor(rows);

    expect(rolesByActor.get("김배우")).toEqual(["햄릿", "오필리아"]);
    expect(rolesByActor.get("이배우")).toEqual(["햄릿"]);
  });

  it("같은 배우의 같은 배역은 중복 저장하지 않는다", () => {
    const rolesByActor = getRolesByActor([
      { actor: "김배우", role: "햄릿" },
      { actor: "김배우", role: "햄릿" },
    ]);

    expect(rolesByActor.get("김배우")).toEqual(["햄릿"]);
  });
});
