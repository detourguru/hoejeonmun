import { describe, expect, it } from "vitest";

import {
  buildCastingChangeTargets,
  matchCancelledEventIds,
  matchCancelledSlotIds,
} from "./notice-targets";

const slots = [
  { id: 1, date: "2026-10-03", time: "14:00" },
  { id: 2, date: "2026-10-03", time: "19:30" },
];

describe("matchCancelledSlotIds", () => {
  it("공지의 날짜와 시각이 같은 회차만 고른다", () => {
    expect(
      matchCancelledSlotIds(slots, [
        { date: "2026-10-03", time: "19:30", imageIndex: 0 },
        { date: "2026-10-04", time: "19:30", imageIndex: 0 },
      ]),
    ).toStrictEqual([2]);
  });
});

describe("matchCancelledEventIds", () => {
  const candidates = [
    {
      id: 10,
      title_key: "스페셜커튼콜위크",
      period_start: "2026-10-01",
      period_end: "2026-10-05",
    },
  ];

  it("띄어쓰기와 문장부호가 달라도 기간이 겹치는 같은 이벤트를 고른다", () => {
    expect(
      matchCancelledEventIds(candidates, [
        {
          title: "스페셜 커튼콜 위크!",
          periodStart: "2026-10-05",
          periodEnd: "2026-10-07",
          imageIndex: 0,
        },
      ]),
    ).toStrictEqual([10]);
  });

  it("기간이 겹치지 않으면 고르지 않는다", () => {
    expect(
      matchCancelledEventIds(candidates, [
        {
          title: "스페셜 커튼콜 위크",
          periodStart: "2026-10-06",
          periodEnd: "2026-10-07",
          imageIndex: 0,
        },
      ]),
    ).toStrictEqual([]);
  });
});

describe("buildCastingChangeTargets", () => {
  const context = {
    slots,
    uploadIdBySlotId: new Map([[1, 100]]),
    actorIdByName: new Map([["정민", 7]]),
  };

  it("회차의 현재 캐스팅 업로드와 배우 id를 붙인다", () => {
    expect(
      buildCastingChangeTargets(
        [
          {
            date: "2026-10-03",
            time: "14:00",
            role: "배역A",
            actor: "정 민",
            imageIndex: 0,
          },
        ],
        context,
      ),
    ).toStrictEqual([
      {
        slot_id: 1,
        upload_id: 100,
        role: "배역A",
        actor: "정 민",
        actor_id: 7,
      },
    ]);
  });

  it("회차, 현재 캐스팅, 배우 중 하나라도 찾지 못하면 뺀다", () => {
    const change = {
      date: "2026-10-03",
      time: "14:00",
      role: "배역A",
      actor: "정민",
      imageIndex: 0,
    };

    expect(
      buildCastingChangeTargets(
        [
          { ...change, date: "2026-10-04" },
          { ...change, time: "19:30" },
          { ...change, actor: "모르는배우" },
        ],
        context,
      ),
    ).toStrictEqual([]);
  });
});
