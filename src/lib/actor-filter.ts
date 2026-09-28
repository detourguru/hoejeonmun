import type { CalendarSlot } from "@/type/casting";

// filterKeys가 없는 회차(예: 내 공연)는 배우 필터 대상이 아니라 항상 보여준다
export const matchesActorFilter = (
  slot: Pick<CalendarSlot, "filterKeys">,
  actors: string[],
) =>
  !slot.filterKeys ||
  actors.length === 0 ||
  actors.some((name) => slot.filterKeys?.includes(name));
