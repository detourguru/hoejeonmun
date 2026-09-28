import { describe, expect, it, vi } from "vitest";

import { ParsedPerformance } from "@/type/casting";

import {
  buildConsensusPerformances,
  pickMostCommonValue,
  shouldCreateCastingBoardOverview,
} from "./parse";

vi.mock("server-only", () => ({}));

// 2026-09-28은 월요일
const performance = (
  casting: Record<string, string[]>,
  overrides: Partial<ParsedPerformance> = {},
): ParsedPerformance => ({
  date: "2026-09-28",
  weekday: "월",
  time: "19:30",
  casting,
  imageIndex: 0,
  confidence: 0.9,
  ...overrides,
});

describe("pickMostCommonValue", () => {
  it("가장 많이 나온 값과 그 횟수를 돌려준다", () => {
    expect(
      pickMostCommonValue(["월", "화", "월"], (value) => value),
    ).toStrictEqual({ count: 2, value: "월" });
  });

  it("비교 기준이 같다고 보는 값은 같은 표로 센다", () => {
    expect(
      pickMostCommonValue(["MON", "mon", "화"], (value) => value.toLowerCase()),
    ).toMatchObject({ count: 2 });
  });

  it("비교 기준을 주지 않으면 내용이 같은 배열, 객체를 같은 값으로 센다", () => {
    expect(pickMostCommonValue([["정휘"], ["정휘"], ["김철수"]])).toStrictEqual(
      {
        count: 2,
        value: ["정휘"],
      },
    );
  });

  it("투표할 값이 없으면 null을 반환한다", () => {
    expect(pickMostCommonValue([])).toBeNull();
  });
});

describe("buildConsensusPerformances", () => {
  // 같은 캐스팅보드를 AI가 3번 읽고, 2번 이상 일치해야 확정한다
  const THRESHOLD = 2;

  it("AI가 2번 이상 같은 배우로 읽은 배역은 그 배우로 확정한다", () => {
    const [voted] = buildConsensusPerformances(
      [
        [performance({ 주인공: ["정휘"] })],
        [performance({ 주인공: ["정휘"] })],
        [performance({ 주인공: ["김철수"] })],
      ],
      THRESHOLD,
    );

    expect(voted.casting).toStrictEqual({ 주인공: ["정휘"] });
    expect(voted.unsureRoles).toBeUndefined();
  });

  it("한 배역에 배우가 여럿이면 적힌 순서가 달라도 같은 결과로 본다", () => {
    const [voted] = buildConsensusPerformances(
      [
        [performance({ 앙상블: ["정휘", "김철수"] })],
        [performance({ 앙상블: ["김철수", "정휘"] })],
      ],
      THRESHOLD,
    );

    expect(voted.casting).toStrictEqual({ 앙상블: ["정휘", "김철수"] });
  });

  it("AI 결과가 모두 갈린 배역은 확정하지 않고 확인이 필요한 배역으로 남긴다", () => {
    const [voted] = buildConsensusPerformances(
      [
        [performance({ 주인공: ["정휘"], 친구: ["박영희"] })],
        [performance({ 주인공: ["김철수"], 친구: ["박영희"] })],
        [performance({ 주인공: ["이민수"], 친구: ["박영희"] })],
      ],
      THRESHOLD,
    );

    expect(voted.casting).toStrictEqual({ 친구: ["박영희"] });
    expect(voted.unsureRoles).toStrictEqual(["주인공"]);
  });

  it("AI가 한 번만 읽은 회차는 버리지 않고, 그 배역들을 확인이 필요한 배역으로 남긴다", () => {
    const voted = buildConsensusPerformances(
      [
        [
          performance({ 주인공: ["정휘"] }),
          performance({ 주인공: ["정휘"] }, { time: "14:00" }),
        ],
        [performance({ 주인공: ["정휘"] })],
      ],
      THRESHOLD,
    );

    expect(voted).toHaveLength(2);
    expect(voted[0]).toMatchObject({
      time: "14:00",
      casting: {},
      unsureRoles: ["주인공"],
    });
  });

  it("요일, 회차 구분 및 이미지 번호도 가장 많이 나온 값으로 정한다", () => {
    const [voted] = buildConsensusPerformances(
      [
        [performance({}, { weekday: "화", variant: "B", imageIndex: 1 })],
        [performance({}, { weekday: "월", variant: "A", imageIndex: 0 })],
        [performance({}, { weekday: "월", variant: "A", imageIndex: 0 })],
      ],
      THRESHOLD,
    );

    expect(voted).toMatchObject({ weekday: "월", variant: "A", imageIndex: 0 });
  });

  it("신뢰도는 가장 높은 값을 쓰고, 한 번이라도 다른 공연 캐스팅으로 의심되면 표시한다", () => {
    const [voted] = buildConsensusPerformances(
      [
        [performance({}, { confidence: 0.6 })],
        [performance({}, { confidence: 0.95, castMismatch: true })],
        [performance({}, { confidence: 0.8 })],
      ],
      THRESHOLD,
    );

    expect(voted).toMatchObject({ confidence: 0.95, castMismatch: true });
  });

  it("결과를 날짜, 시각 순으로 정렬한다", () => {
    const voted = buildConsensusPerformances(
      [
        [
          performance({}, { date: "2026-09-29", weekday: "화", time: "14:00" }),
          performance({}, { time: "19:30" }),
          performance({}, { time: "14:00" }),
        ],
      ],
      1,
    );

    expect(voted.map(({ date, time }) => `${date} ${time}`)).toStrictEqual([
      "2026-09-28 14:00",
      "2026-09-28 19:30",
      "2026-09-29 14:00",
    ]);
  });
});

describe("shouldCreateCastingBoardOverview", () => {
  const image = (width: number, height: number, index = 0) => ({
    index,
    buffer: Buffer.alloc(0),
    width,
    height,
  });

  // 휴대폰으로 긴 캐스팅표를 나눠 캡처한 경우 (세로로 긴 같은 너비의 이미지)
  const capture = (index: number) => image(1000, 2000, index);

  it("같은 표를 나눠 찍은 세로로 긴 캡처 여러 장은 이어 붙인 전체 이미지를 만든다", () => {
    expect(shouldCreateCastingBoardOverview([capture(0), capture(1)])).toBe(
      true,
    );
  });

  it("이미지가 한 장이면 이어 붙일 게 없어 만들지 않는다", () => {
    expect(shouldCreateCastingBoardOverview([capture(0)])).toBe(false);
  });

  it("너비가 가장 넓은 이미지의 85%까지는 같은 표를 나눠 찍은 것으로 본다", () => {
    expect(
      shouldCreateCastingBoardOverview([capture(0), image(850, 2000, 1)]),
    ).toBe(true);
  });

  it("너비가 85%보다 좁은 이미지가 섞이면 서로 다른 이미지로 보고 만들지 않는다", () => {
    expect(
      shouldCreateCastingBoardOverview([capture(0), image(849, 2000, 1)]),
    ).toBe(false);
  });

  it("세로로 긴(높이가 너비의 1.15배 이상) 이미지가 2장 이상이어야 만든다", () => {
    expect(
      shouldCreateCastingBoardOverview([
        image(1000, 1150, 0),
        image(1000, 1150, 1),
      ]),
    ).toBe(true);
    expect(
      shouldCreateCastingBoardOverview([
        image(1000, 2000, 0),
        image(1000, 1149, 1),
      ]),
    ).toBe(false);
  });

  it("크기를 읽지 못한 이미지가 있으면 만들지 않는다", () => {
    expect(shouldCreateCastingBoardOverview([capture(0), image(0, 0, 1)])).toBe(
      false,
    );
  });
});
