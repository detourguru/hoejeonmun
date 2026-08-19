import { CalendarSlot, EventSession } from "@/type/casting";

// 그날 가장 늦은 회차가 밤공, 나머지가 낮공.
// 회차가 하나뿐인 날은 낮/밤을 가를 근거가 없어 판정하지 않는다
export function getSessionBySlotId(
  slots: CalendarSlot[],
): Map<number, EventSession> {
  const byDate = new Map<string, CalendarSlot[]>();

  for (const slot of slots) {
    byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot]);
  }

  const sessions = new Map<number, EventSession>();

  for (const daySlots of byDate.values()) {
    if (daySlots.length < 2) continue;

    const ordered = [...daySlots].sort((a, b) => a.time.localeCompare(b.time));

    ordered.forEach((slot, index) =>
      sessions.set(
        slot.id,
        index === ordered.length - 1 ? "evening" : "matinee",
      ),
    );
  }

  return sessions;
}

// 판정하지 못한 날에는 낮공 이벤트도 밤공 이벤트도 그대로 보여준다
export const appliesToSession = (
  eventSession: EventSession | null,
  slotSession: EventSession | undefined,
) => !eventSession || !slotSession || eventSession === slotSession;
