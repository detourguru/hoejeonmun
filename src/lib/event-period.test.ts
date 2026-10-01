import { describe, expect, it } from "vitest";

import {
  createSlotChecker,
  datesWithoutSchedule,
  SlotRules,
  slotsWithinPeriod,
  toggleExcludedSlot,
} from "./event-period";

const rules = (overrides: Partial<SlotRules> = {}): SlotRules => ({
  excludedSlots: [],
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  ...overrides,
});

const slot = (date: string, time: string) => ({ date, time });

describe("createSlotChecker", () => {
  it("따로 정한 규칙이 없으면 기간 안 모든 회차에 이벤트를 적용한다", () => {
    const isChecked = createSlotChecker(rules());

    expect(isChecked(slot("2026-09-10", "14:00"))).toBe(true);
    expect(isChecked(slot("2026-09-10", "19:30"))).toBe(true);
  });

  it("업로더가 체크 해제한 9/10 19:30 회차에는 이벤트를 적용하지 않는다", () => {
    const isChecked = createSlotChecker(
      rules({ excludedSlots: [slot("2026-09-10", "19:30")] }),
    );

    expect(isChecked(slot("2026-09-10", "19:30"))).toBe(false);
    expect(isChecked(slot("2026-09-10", "14:00"))).toBe(true);
  });

  it("안내문에 '19:30 공연'처럼 시각만 적혀 있으면 그 시각 회차에만 적용한다", () => {
    const isChecked = createSlotChecker(rules({ exactTimes: ["19:30"] }));

    expect(isChecked(slot("2026-09-10", "19:30"))).toBe(true);
    expect(isChecked(slot("2026-09-10", "14:00"))).toBe(false);
  });

  it("안내문에 회차가 하나하나 나열돼 있으면 나열된 회차에만 적용한다", () => {
    const isChecked = createSlotChecker(
      rules({ listedSlots: [slot("2026-09-10", "19:30")] }),
    );

    expect(isChecked(slot("2026-09-10", "19:30"))).toBe(true);
    expect(isChecked(slot("2026-09-11", "19:30"))).toBe(false);
  });

  it.each([
    [slot("2026-09-01", "14:00"), false],
    [slot("2026-09-01", "19:30"), true],
    [slot("2026-09-02", "14:00"), true],
  ])(
    "이벤트가 9/1 19:30 공연부터 시작하면 첫날의 그보다 이른 회차만 뺀다: %j",
    (target, expected) => {
      const isChecked = createSlotChecker(
        rules({ periodStartCutoffTime: "19:30" }),
      );

      expect(isChecked(target)).toBe(expected);
    },
  );

  it.each([
    [slot("2026-09-30", "19:30"), false],
    [slot("2026-09-30", "14:00"), true],
    [slot("2026-09-29", "19:30"), true],
  ])(
    "이벤트가 9/30 14:00 공연까지면 마지막 날의 그보다 늦은 회차만 뺀다: %j",
    (target, expected) => {
      const isChecked = createSlotChecker(
        rules({ periodEndCutoffTime: "14:00" }),
      );

      expect(isChecked(target)).toBe(expected);
    },
  );

  it("규칙이 여러 개면 모두 만족하는 회차에만 적용한다", () => {
    const isChecked = createSlotChecker(
      rules({
        exactTimes: ["19:30"],
        excludedSlots: [slot("2026-09-10", "19:30")],
      }),
    );

    expect(isChecked(slot("2026-09-10", "19:30"))).toBe(false);
    expect(isChecked(slot("2026-09-11", "19:30"))).toBe(true);
    expect(isChecked(slot("2026-09-11", "14:00"))).toBe(false);
  });
});

describe("toggleExcludedSlot", () => {
  const slots = [
    slot("2026-09-10", "14:00"),
    slot("2026-09-10", "19:30"),
    slot("2026-09-11", "19:30"),
  ];

  it("적용 중인 회차를 체크 해제하면 제외 목록에 넣는다", () => {
    const isChecked = createSlotChecker(rules());

    expect(
      toggleExcludedSlot(slots, isChecked, slot("2026-09-10", "14:00")),
    ).toEqual([slot("2026-09-10", "14:00")]);
  });

  it("제외한 회차를 다시 체크하면 제외 목록에서 뺀다", () => {
    const isChecked = createSlotChecker(
      rules({ excludedSlots: [slot("2026-09-10", "14:00")] }),
    );

    expect(
      toggleExcludedSlot(slots, isChecked, slot("2026-09-10", "14:00")),
    ).toEqual([]);
  });

  it("'19:30 공연'으로 빠져 있던 14:00 회차는 다른 회차를 토글해도 계속 빠진 채로 남는다", () => {
    const isChecked = createSlotChecker(rules({ exactTimes: ["19:30"] }));

    expect(
      toggleExcludedSlot(slots, isChecked, slot("2026-09-11", "19:30")),
    ).toEqual([slot("2026-09-10", "14:00"), slot("2026-09-11", "19:30")]);
  });
});

describe("datesWithoutSchedule", () => {
  it("이벤트 기간 9/29~10/2 중 공연이 없는 날만 시작일과 종료일까지 포함해 알려준다", () => {
    const knownDates = new Set(["2026-09-30", "2026-10-01"]);

    expect(
      datesWithoutSchedule("2026-09-29", "2026-10-02", knownDates),
    ).toEqual(["2026-09-29", "2026-10-02"]);
  });

  it("기간 내 모든 날에 공연이 있으면 알려줄 날이 없다", () => {
    const knownDates = new Set(["2026-09-10", "2026-09-11"]);

    expect(
      datesWithoutSchedule("2026-09-10", "2026-09-11", knownDates),
    ).toEqual([]);
  });

  it.each([
    ["", "2026-09-30"],
    ["2026-09-01", ""],
    ["2026-09-30", "2026-09-01"],
  ])(
    "기간이 비었거나 시작일이 종료일보다 늦으면 공연 없는 날을 알려주지 않는다: %j ~ %j",
    (periodStart, periodEnd) => {
      expect(datesWithoutSchedule(periodStart, periodEnd, new Set())).toEqual(
        [],
      );
    },
  );
});

describe("slotsWithinPeriod", () => {
  it("이벤트 기간 9/10~9/11에 걸린 회차만 날짜, 시각 순으로 보여준다", () => {
    const knownSlots = [
      slot("2026-09-11", "14:00"),
      slot("2026-09-12", "19:30"),
      slot("2026-09-10", "19:30"),
      slot("2026-09-09", "19:30"),
      slot("2026-09-10", "14:00"),
    ];

    expect(slotsWithinPeriod("2026-09-10", "2026-09-11", knownSlots)).toEqual([
      slot("2026-09-10", "14:00"),
      slot("2026-09-10", "19:30"),
      slot("2026-09-11", "14:00"),
    ]);
  });
});
