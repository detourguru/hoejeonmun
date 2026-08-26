import type { EventWithReportStatus } from "@/service/casting";
import type { CalendarSlot } from "@/type/casting";

export type EventWithSlotTimes = EventWithReportStatus & {
  // 회차 전체일때 undefined
  times?: string[];
};

export function matchEventsToDate(
  dateSlots: CalendarSlot[],
  events: EventWithReportStatus[],
): EventWithSlotTimes[] {
  return events.map((event) => {
    const matchedTimes = dateSlots
      .filter((slot) => event.slotIds.includes(slot.id))
      .map((slot) => slot.time);

    // 전체 적용(또는 아직 회차에 못 걸린 이벤트)이면 시간을 안 적는다
    const isPartial =
      matchedTimes.length > 0 && matchedTimes.length < dateSlots.length;

    return isPartial ? { ...event, times: matchedTimes } : event;
  });
}
