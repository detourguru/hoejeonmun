import { describe, expect, it } from "vitest";

import { PendingEvent } from "@/type/casting";

import {
  EventDraft,
  toConfirmedEvents,
  toEventDrafts,
} from "./event-confirm-list";

// AI가 캐스팅보드에서 읽은 이벤트
const pending = (overrides: Partial<PendingEvent> = {}): PendingEvent => ({
  title: "스페셜 커튼콜",
  periodStart: "2026-09-28",
  periodEnd: "2026-09-30",
  printedStartWeekday: "월",
  printedEndWeekday: "수",
  source: "notice",
  imageIndex: 0,
  confirmReasons: [],
  overlapping: [],
  ...overrides,
});

// 업로더가 확인 화면에서 original을 event로 고친 상태
const draft = (
  changes: Partial<PendingEvent> = {},
  overrides: Partial<EventDraft> = {},
): EventDraft => ({
  event: pending(changes),
  original: pending(),
  include: true,
  ...overrides,
});

describe("toEventDrafts", () => {
  it("확인 화면에서는 기간이 빠른 이벤트부터 보여 줘서 비슷한 이벤트가 붙어 보이게 한다", () => {
    const later = pending({ title: "막공", periodStart: "2026-10-01" });
    const sooner = pending({ title: "첫공", periodStart: "2026-09-01" });

    expect(
      toEventDrafts([later, sooner]).map(({ event }) => event.title),
    ).toStrictEqual(["첫공", "막공"]);
  });

  it("처음에는 모든 이벤트를 등록 대상으로 두고, AI가 같은 이벤트로 본 기존 이벤트가 있으면 그걸 대체하도록 골라 둔다", () => {
    const [created] = toEventDrafts([pending({ suggestedSameAsGroupId: 7 })]);

    expect(created).toMatchObject({ include: true, replacesGroupId: 7 });
  });
});

describe("toConfirmedEvents", () => {
  it("업로더가 등록하지 않기로 뺀 이벤트는 저장하지 않는다", () => {
    expect(
      toConfirmedEvents([draft({}, { include: false }), draft()]),
    ).toHaveLength(1);
  });

  it("업로더가 아무것도 고치지 않았으면 'AI가 읽은 일정'으로 저장한다", () => {
    const [confirmed] = toConfirmedEvents([draft()]);

    expect(confirmed.edited).toBe(false);
  });

  it.each<[string, Partial<PendingEvent>]>([
    ["제목", { title: "스페셜 커튼콜 위크" }],
    ["시작일", { periodStart: "2026-09-29" }],
    ["종료일", { periodEnd: "2026-10-01" }],
    [
      "추가로 포함한 회차",
      { includedSlots: [{ date: "2026-10-01", time: "19:30" }] },
    ],
    ["뺀 회차", { excludedSlots: [{ date: "2026-09-28", time: "19:30" }] }],
    ["적용 시각", { exactTimes: ["19:30"] }],
  ])(
    "업로더가 %s을(를) 고쳤으면 '제보자가 확인하고 고친 일정'으로 저장한다",
    (_, changes) => {
      const [confirmed] = toConfirmedEvents([draft(changes)]);

      expect(confirmed.edited).toBe(true);
    },
  );

  it("회차 목록이 없던 것과 빈 목록은 같은 것으로 보고 고친 것으로 치지 않는다", () => {
    const [confirmed] = toConfirmedEvents([
      draft({ includedSlots: [], excludedSlots: [], exactTimes: [] }),
    ]);

    expect(confirmed.edited).toBe(false);
  });

  it("업로더가 대체하기로 고른 기존 이벤트 그룹을 함께 넘긴다", () => {
    const [confirmed] = toConfirmedEvents([draft({}, { replacesGroupId: 7 })]);

    expect(confirmed.replacesGroupId).toBe(7);
  });
});
