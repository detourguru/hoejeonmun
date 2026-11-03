import { describe, expect, it } from "vitest";

import {
  countIncludedNotices,
  describeNotice,
  toExcludedNotices,
  toggleNotice,
  toNoticeDrafts,
} from "./notice-confirm-list";

const notices = {
  cancelledSlots: [
    { date: "2026-10-03", time: "14:00", imageIndex: 0 },
    { date: "2026-10-03", time: "19:30", imageIndex: 0 },
  ],
  castingChanges: [
    {
      date: "2026-10-03",
      time: "14:00",
      role: "배역A",
      actor: "배우1",
      imageIndex: 0,
    },
  ],
  cancelledEvents: [],
};

describe("toNoticeDrafts", () => {
  it("공지에서 읽은 항목은 처음에 모두 적용하는 상태로 둔다", () => {
    const drafts = toNoticeDrafts(notices);

    expect(countIncludedNotices(drafts)).toBe(3);
    expect(toExcludedNotices(drafts)).toStrictEqual({
      cancelledSlots: [],
      castingChanges: [],
      cancelledEvents: [],
    });
  });
});

describe("toggleNotice", () => {
  it("체크를 푼 항목은 보관본 번호로 제외 목록에 들어간다", () => {
    const drafts = toggleNotice(
      toggleNotice(toNoticeDrafts(notices), "cancelledSlots", 1),
      "castingChanges",
      0,
    );

    expect(countIncludedNotices(drafts)).toBe(1);
    expect(toExcludedNotices(drafts)).toStrictEqual({
      cancelledSlots: [1],
      castingChanges: [0],
      cancelledEvents: [],
    });
  });

  it("다시 체크하면 제외 목록에서 빠진다", () => {
    const drafts = toggleNotice(
      toggleNotice(toNoticeDrafts(notices), "cancelledSlots", 0),
      "cancelledSlots",
      0,
    );

    expect(toExcludedNotices(drafts).cancelledSlots).toStrictEqual([]);
  });

  it("기존 배우를 찾으면 배역과 이전/새 배우를 함께 표시한다", () => {
    const [change] = toNoticeDrafts(notices, [
      {
        date: "2026-10-03",
        time: "14:00:00",
        role_name_raw: "배역A",
        actor_name_raw: "이전 배우",
      },
    ]).filter(({ kind }) => kind === "castingChanges");

    expect(describeNotice(change)).toBe(
      "10/3 14:00 배역A 役 이전 배우 → 배우1",
    );
  });

  it("이전 배우가 없거나 여러 명이면 잘못된 이름을 추측하지 않는다", () => {
    const [withoutMatch] = toNoticeDrafts(notices).filter(
      ({ kind }) => kind === "castingChanges",
    );
    const [ambiguous] = toNoticeDrafts(notices, [
      {
        date: "2026-10-03",
        time: "14:00",
        role_name_raw: "배역A",
        actor_name_raw: "이전 배우1",
      },
      {
        date: "2026-10-03",
        time: "14:00",
        role_name_raw: "배역A",
        actor_name_raw: "이전 배우2",
      },
    ]).filter(({ kind }) => kind === "castingChanges");

    expect(describeNotice(withoutMatch)).toBe("10/3 14:00 배역A 役 배우1");
    expect(describeNotice(ambiguous)).toBe("10/3 14:00 배역A 役 배우1");
  });
});
