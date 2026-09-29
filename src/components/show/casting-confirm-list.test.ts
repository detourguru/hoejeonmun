import { describe, expect, it } from "vitest";

import { ParsedPerformance } from "@/type/casting";

import {
  CastingDraft,
  removeActorFromDrafts,
  removeRole,
  renameActor,
  renameRole,
  toConfirmedPerformances,
} from "./casting-confirm-list";

// AI가 캐스팅보드에서 읽은 회차 하나
const draft = (
  casting: Record<string, string[]>,
  overrides: Partial<ParsedPerformance> = {},
): CastingDraft => ({
  performance: {
    date: "2026-09-28",
    weekday: "월",
    time: "19:30",
    casting,
    imageIndex: 0,
    confidence: 1,
    ...overrides,
  },
  include: true,
});

const castingOf = (drafts: CastingDraft[]) =>
  drafts.map(({ performance }) => performance.casting);

describe("toConfirmedPerformances", () => {
  it("업로더가 등록하지 않기로 뺀 회차는 저장하지 않는다", () => {
    const kept = draft({ 햄릿: ["김배우"] });
    const dropped = { ...draft({ 햄릿: ["이배우"] }), include: false };

    expect(toConfirmedPerformances([kept, dropped])).toStrictEqual([
      kept.performance,
    ]);
  });
});

describe("renameRole", () => {
  it("배역 이름을 고치면 그 배역이 있는 모든 회차에서 함께 바뀌고 배우는 그대로 남는다", () => {
    const drafts = [
      draft({ 햄릿역: ["김배우"], 오필리아: ["박배우"] }),
      draft({ 햄릿역: ["이배우"] }, { time: "14:00" }),
    ];

    expect(castingOf(renameRole(drafts, "햄릿역", "햄릿"))).toStrictEqual([
      { 햄릿: ["김배우"], 오필리아: ["박배우"] },
      { 햄릿: ["이배우"] },
    ]);
  });

  it("그 배역이 없는 회차는 건드리지 않는다", () => {
    const untouched = draft({ 오필리아: ["박배우"] });

    const [result] = renameRole([untouched], "햄릿역", "햄릿");

    expect(result.performance).toBe(untouched.performance);
  });

  it("AI가 '햄릿'과 '햄 릿'으로 나눠 읽은 배역을 '햄릿'으로 고치면 두 배우 모두 햄릿 배우로 남는다", () => {
    const drafts = [draft({ 햄릿: ["김배우"], "햄 릿": ["이배우"] })];

    expect(castingOf(renameRole(drafts, "햄 릿", "햄릿"))).toStrictEqual([
      { 햄릿: ["김배우", "이배우"] },
    ]);
  });

  it("배역 순서가 반대여도 고친 쪽 배우가 사라지지 않는다", () => {
    const drafts = [draft({ "햄 릿": ["이배우"], 햄릿: ["김배우"] })];

    expect(castingOf(renameRole(drafts, "햄 릿", "햄릿"))).toStrictEqual([
      { 햄릿: ["이배우", "김배우"] },
    ]);
  });

  it("두 배역에 같은 배우가 들어 있으면 합칠 때 한 번만 남긴다", () => {
    const drafts = [draft({ 햄릿: ["김배우"], "햄 릿": ["김배우", "이배우"] })];

    expect(castingOf(renameRole(drafts, "햄 릿", "햄릿"))).toStrictEqual([
      { 햄릿: ["김배우", "이배우"] },
    ]);
  });
});

describe("removeRole", () => {
  it("배역이 없는 회차는 그대로 유지한다", () => {
    const original = draft({ 햄릿: ["김배우"] });
    expect(removeRole([original], "오필리아")[0].performance).toBe(
      original.performance,
    );
  });
  it("AI가 잘못 읽은 배역을 지우면 모든 회차에서 그 배역과 배우가 함께 빠진다", () => {
    const drafts = [
      draft({ 햄릿: ["김배우"], "": ["박배우"] }),
      draft({ "": ["최배우"] }, { time: "14:00" }),
    ];

    expect(castingOf(removeRole(drafts, ""))).toStrictEqual([
      { 햄릿: ["김배우"] },
      {},
    ]);
  });
});

describe("renameActor", () => {
  it("배역이 없는 회차는 그대로 유지한다", () => {
    const original = draft({ 햄릿: ["김배우"] });
    expect(
      renameActor([original], "오필리아", "김배우", "이배우")[0].performance,
    ).toBe(original.performance);
  });
  it("배우 이름을 고치면 같은 배역의 그 배우만 모든 회차에서 바뀐다", () => {
    const drafts = [
      draft({ 앙상블: ["김배우", "이배우"], 햄릿: ["김배우"] }),
      draft({ 앙상블: ["김배우"] }, { time: "14:00" }),
    ];

    expect(
      castingOf(renameActor(drafts, "앙상블", "김배우", "김배우2")),
    ).toStrictEqual([
      { 앙상블: ["김배우2", "이배우"], 햄릿: ["김배우"] },
      { 앙상블: ["김배우2"] },
    ]);
  });

  it("같은 배역에 이미 있는 배우 이름으로 고치면 그 배우가 두 번 저장되지 않게 하나만 남긴다", () => {
    const drafts = [draft({ 앙상블: ["김배우", "김 배우", "이배우"] })];

    expect(
      castingOf(renameActor(drafts, "앙상블", "김 배우", "김배우")),
    ).toStrictEqual([{ 앙상블: ["김배우", "이배우"] }]);
  });
});

describe("removeActorFromDrafts", () => {
  it("배역이 없는 회차는 그대로 유지한다", () => {
    const original = draft({ 햄릿: ["김배우"] });
    expect(
      removeActorFromDrafts([original], "오필리아", "김배우")[0].performance,
    ).toBe(original.performance);
  });
  it("여러 명이 맡은 배역에서 배우 한 명을 지우면 나머지 배우는 남는다", () => {
    const [result] = removeActorFromDrafts(
      [draft({ 앙상블: ["김배우", "이배우"] })],
      "앙상블",
      "김배우",
    );

    expect(result.performance.casting).toStrictEqual({ 앙상블: ["이배우"] });
  });

  it("배역의 마지막 배우를 지우면 배우 없는 빈 배역이 남지 않도록 배역도 지운다", () => {
    const [result] = removeActorFromDrafts(
      [draft({ 햄릿: ["김배우"], 오필리아: [""] })],
      "오필리아",
      "",
    );

    expect(result.performance.casting).toStrictEqual({ 햄릿: ["김배우"] });
  });
});
