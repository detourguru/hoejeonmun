import { describe, expect, it } from "vitest";

import type { EventWithReportStatus } from "@/service/casting";
import type { CalendarSlot } from "@/type/casting";

import {
  eventAppliesToDate,
  isOpeningOrClosingEvent,
  isPreviewEvent,
  matchEventsToDate,
} from "./event-slots";

const event = (
  overrides: Partial<EventWithReportStatus> = {},
): EventWithReportStatus => ({
  id: 1,
  groupId: 1,
  title: "커튼콜데이",
  description: null,
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  sparseDates: false,
  slotIds: [],
  uploadId: 1,
  uploadImageId: 1,
  edited: false,
  reported: false,
  bookmarked: false,
  imageUrl: null,
  isMine: false,
  canDelete: false,
  ...overrides,
});

const slot = (id: number, time: string): CalendarSlot => ({
  id,
  date: "2026-09-10",
  time,
  label: "",
});

describe("isOpeningOrClosingEvent", () => {
  it.each([["첫공"], ["막공"], ["막 공 "]])(
    "공백을 빼면 제목이 첫공이나 막공이면 첫공/막공 이벤트다: %j",
    (title) => {
      expect(isOpeningOrClosingEvent(title)).toBe(true);
    },
  );

  it.each([["첫공 기념 이벤트"], ["프리뷰"]])(
    "제목이 첫공이나 막공과 정확히 같지 않으면 첫공/막공 이벤트가 아니다: %j",
    (title) => {
      expect(isOpeningOrClosingEvent(title)).toBe(false);
    },
  );
});

describe("isPreviewEvent", () => {
  it.each([["프리뷰"], [" 프리 뷰"]])(
    "공백을 빼면 제목이 프리뷰면 프리뷰 이벤트다: %j",
    (title) => {
      expect(isPreviewEvent(title)).toBe(true);
    },
  );

  it("제목에 다른 말이 붙어 있으면 프리뷰 이벤트가 아니다", () => {
    expect(isPreviewEvent("프리뷰 할인")).toBe(false);
  });
});

describe("eventAppliesToDate", () => {
  describe("그 날짜에 회차가 있으면", () => {
    const slotsOnDate = [{ id: 10 }, { id: 11 }];

    it("이벤트가 그중 한 회차에라도 걸려 있으면 적용된다", () => {
      expect(
        eventAppliesToDate(event({ slotIds: [11] }), "2026-09-10", slotsOnDate),
      ).toBe(true);
    });

    it("기간 안이어도 걸린 회차가 없으면 적용되지 않는다", () => {
      expect(
        eventAppliesToDate(event({ slotIds: [99] }), "2026-09-10", slotsOnDate),
      ).toBe(false);
    });
  });

  describe("그 날짜에 회차가 없으면 기간으로 판단한다", () => {
    it.each([["2026-09-01"], ["2026-09-15"], ["2026-09-30"]])(
      "기간(9/1~9/30) 안이면 시작일과 종료일을 포함해 적용된다: %s",
      (date) => {
        expect(eventAppliesToDate(event(), date, [])).toBe(true);
      },
    );

    it.each([["2026-08-31"], ["2026-10-01"]])(
      "기간(9/1~9/30) 밖이면 적용되지 않는다: %s",
      (date) => {
        expect(eventAppliesToDate(event(), date, [])).toBe(false);
      },
    );

    it("띄엄띄엄 적용되는 이벤트(sparseDates)는 기간 안이어도 적용되지 않는다", () => {
      expect(
        eventAppliesToDate(event({ sparseDates: true }), "2026-09-15", []),
      ).toBe(false);
    });
  });
});

describe("matchEventsToDate", () => {
  const dateSlots = [slot(10, "14:00"), slot(11, "19:30")];

  it("그날 일부 회차에만 걸린 이벤트는 해당 회차 시각을 times에 담는다", () => {
    const [matched] = matchEventsToDate(dateSlots, [event({ slotIds: [11] })]);

    expect(matched.times).toStrictEqual(["19:30"]);
  });

  it("그날 모든 회차에 걸린 이벤트는 times를 붙이지 않는다", () => {
    const [matched] = matchEventsToDate(dateSlots, [
      event({ slotIds: [10, 11] }),
    ]);

    expect(matched).not.toHaveProperty("times");
  });

  it("그날 어느 회차에도 걸리지 않은 이벤트는 times를 붙이지 않는다", () => {
    const [matched] = matchEventsToDate(dateSlots, [event({ slotIds: [] })]);

    expect(matched).not.toHaveProperty("times");
  });

  it("이벤트의 나머지 정보는 그대로 유지한다", () => {
    const original = event({ id: 7, title: "막공", slotIds: [10] });

    const [matched] = matchEventsToDate(dateSlots, [original]);

    expect(matched).toStrictEqual({ ...original, times: ["14:00"] });
  });
});
