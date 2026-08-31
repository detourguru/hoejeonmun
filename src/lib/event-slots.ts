import type { EventWithReportStatus } from "@/service/casting";
import type { CalendarSlot } from "@/type/casting";

export function eventAppliesToDate(
  event: Pick<
    EventWithReportStatus,
    "periodStart" | "periodEnd" | "sparseDates" | "slotIds"
  >,
  date: string,
  slotsOnDate: Pick<CalendarSlot, "id">[],
): boolean {
  if (
    !event.sparseDates &&
    event.periodStart <= date &&
    date <= event.periodEnd
  ) {
    return true;
  }

  return slotsOnDate.some((slot) => event.slotIds.includes(slot.id));
}

export type EventWithSlotTimes<
  T extends EventWithReportStatus = EventWithReportStatus,
> = T & {
  // 회차 전체일때 undefined
  times?: string[];
};

export function matchEventsToDate<T extends EventWithReportStatus>(
  dateSlots: CalendarSlot[],
  events: T[],
): EventWithSlotTimes<T>[] {
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
