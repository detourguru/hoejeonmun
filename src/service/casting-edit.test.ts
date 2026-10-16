import { describe, expect, it, vi } from "vitest";

import { describeCastingEdit } from "./casting-edit";

vi.mock("server-only", () => ({}));

const lookup = {
  slotLabel: (id: number) =>
    ({ 1: "10/3 14:00", 2: "10/3 19:30", 3: "10/4 14:00", 4: "10/4 19:30" })[
      id
    ] ?? "삭제된 회차",
  eventTitle: (id: number) => (id === 7 ? "커튼콜 데이" : "삭제된 이벤트"),
};

describe("describeCastingEdit", () => {
  it("공지로 취소된 회차와 이벤트를 알아볼 수 있게 적는다", () => {
    expect(
      describeCastingEdit(
        {
          action: "cancel_slot",
          target: { slot_id: 1 },
          before: null,
          after: null,
        },
        lookup,
      ),
    ).toStrictEqual({ label: "회차 취소", detail: "10/3 14:00" });
    expect(
      describeCastingEdit(
        {
          action: "cancel_event",
          target: { event_id: 7 },
          before: null,
          after: null,
        },
        lookup,
      ),
    ).toStrictEqual({ label: "이벤트 취소", detail: "커튼콜 데이" });
  });

  it("배우가 바뀐 정정은 이전 값과 새 값을 함께 적는다", () => {
    expect(
      describeCastingEdit(
        {
          action: "update_casting",
          target: { upload_id: 1, slot_ids: [1, 2] },
          before: { role: "배역A", actor_name_raw: "배우1" },
          after: { role: "배역A", actor_name_raw: "배우9" },
        },
        lookup,
      ),
    ).toStrictEqual({
      label: "배역·배우 수정",
      detail: "배역A 배우1 → 배역A 배우9 (10/3 14:00, 10/3 19:30)",
    });
  });

  it("회차가 많으면 첫 회차와 나머지 개수만 적는다", () => {
    expect(
      describeCastingEdit(
        {
          action: "delete_casting",
          target: { upload_id: 1, slot_ids: [1, 2, 3, 4] },
          before: {
            rows: [
              { slot_id: 1, role_name_raw: "배역A", actor_name_raw: "배우1" },
            ],
          },
          after: null,
        },
        lookup,
      ),
    ).toStrictEqual({
      label: "배역 삭제",
      detail: "배역A 배우1 (10/3 14:00 외 3회차)",
    });
  });

  it("회차 이동과 회차 구분은 바뀌기 전과 후를 적고, 없던 값은 '없음'으로 적는다", () => {
    expect(
      describeCastingEdit(
        {
          action: "move_slot",
          target: { upload_id: 1 },
          before: { slot_id: 2 },
          after: { slot_id: 3 },
        },
        lookup,
      ),
    ).toStrictEqual({ label: "회차 이동", detail: "10/3 19:30 → 10/4 14:00" });
    expect(
      describeCastingEdit(
        {
          action: "update_variant",
          target: { upload_id: 1, slot_id: 1 },
          before: { label: null },
          after: { label: "룸 서울" },
        },
        lookup,
      ),
    ).toStrictEqual({
      label: "회차 구분",
      detail: "10/3 14:00 없음 → 룸 서울",
    });
  });
});
