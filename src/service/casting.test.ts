import { describe, expect, it, vi } from "vitest";

import {
  getPairKey,
  groupByDate,
  groupBySlot,
  SlotCastingRow,
} from "./casting";

vi.mock("server-only", () => ({}));

describe("getPairKey", () => {
  it("캐스팅표 앞 두 열의 배우를 주연 페어로 묶어 표시한다", () => {
    expect(getPairKey(["정휘", "김철수", "박영희", "이민수"])).toBe(
      "정휘·김철수",
    );
  });

  it("배우가 한 명뿐이면 그 배우만 표시한다", () => {
    expect(getPairKey(["정휘"])).toBe("정휘");
  });
});

describe("groupByDate", () => {
  it("같은 날짜의 항목끼리 들어온 순서대로 묶는다", () => {
    const grouped = groupByDate([
      { date: "2026-09-28", time: "19:30" },
      { date: "2026-09-29", time: "14:00" },
      { date: "2026-09-28", time: "14:00" },
    ]);

    expect([...grouped.entries()]).toStrictEqual([
      [
        "2026-09-28",
        [
          { date: "2026-09-28", time: "19:30" },
          { date: "2026-09-28", time: "14:00" },
        ],
      ],
      ["2026-09-29", [{ date: "2026-09-29", time: "14:00" }]],
    ]);
  });
});

// slot_castings 뷰에서 읽은 배우 한 명 행
const row = (overrides: Partial<SlotCastingRow> = {}): SlotCastingRow => ({
  slot_id: 1,
  upload_id: 10,
  date: "2026-09-28",
  time: "19:30:00",
  role_name_raw: "햄릿",
  actor_name_raw: "김배우",
  actor_id: 100,
  verified: false,
  assignment_id: 1000,
  role_order: 0,
  upload_source: "user",
  fallback: false,
  variant: null,
  ...overrides,
});

describe("groupBySlot", () => {
  it("배우별로 나뉜 행을 회차 하나의 캐스팅으로 묶고, 캐스팅표에 적힌 순서를 지킨다", () => {
    const [slot] = groupBySlot([
      row({ role_name_raw: "햄릿", actor_name_raw: "김배우" }),
      row({ role_name_raw: "오필리아", actor_name_raw: "박배우" }),
    ]);

    expect(
      slot.casting.map(({ role, actor }) => `${role}:${actor}`),
    ).toStrictEqual(["햄릿:김배우", "오필리아:박배우"]);
  });

  it("다른 회차의 행은 회차별로 따로 묶는다", () => {
    const slots = groupBySlot([
      row({ slot_id: 1 }),
      row({ slot_id: 2, time: "14:00:00" }),
      row({ slot_id: 1, role_name_raw: "오필리아" }),
    ]);

    expect(slots.map(({ id, casting }) => [id, casting.length])).toStrictEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it("DB의 초 단위 시각(19:30:00)은 화면에 보이는 19:30으로 줄인다", () => {
    const [slot] = groupBySlot([row({ time: "19:30:00" })]);

    expect(slot.time).toBe("19:30");
  });

  it("앙상블처럼 한 배역에 배우가 여럿이면 모두 남긴다", () => {
    const [slot] = groupBySlot([
      row({ role_name_raw: "앙상블", actor_name_raw: "김배우" }),
      row({ role_name_raw: "앙상블", actor_name_raw: "이배우" }),
    ]);

    expect(slot.casting.map(({ actor }) => actor)).toStrictEqual([
      "김배우",
      "이배우",
    ]);
  });

  it("업로드 정보(누가 올렸는지, 회차 구분 등)와 배우별 확인 여부를 화면에 넘긴다", () => {
    const [slot] = groupBySlot([
      row({
        upload_id: 10,
        upload_source: "system",
        fallback: true,
        variant: "ROOM SEOUL",
        actor_id: null,
        verified: true,
      }),
    ]);

    expect(slot).toMatchObject({
      uploadId: 10,
      uploadSource: "system",
      fallback: true,
      variant: "ROOM SEOUL",
      casting: [{ actorId: null, verified: true }],
    });
  });
});
