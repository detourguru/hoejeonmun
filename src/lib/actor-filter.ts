import type { CalendarSlot } from "@/type/casting";

// 같은 배역으로 묶인 배우끼리는 그중 한 명만 나와도 되고(OR), 배역이 다르면 전원 나와야(AND) 페어로 본다
function groupByRole(actors: string[], roleByActor: Map<string, string>) {
  const actorsByRole = new Map<string, string[]>();

  for (const actor of actors) {
    const role = roleByActor.get(actor) ?? actor;

    actorsByRole.set(role, [...(actorsByRole.get(role) ?? []), actor]);
  }

  return [...actorsByRole.values()];
}

// filterKeys가 없는 회차(예: 내 공연)는 배우 필터 대상이 아니라 항상 보여준다
export const matchesActorFilter = (
  slot: Pick<CalendarSlot, "filterKeys">,
  actors: string[],
  roleByActor?: Map<string, string>,
) => {
  if (!slot.filterKeys || actors.length === 0) return true;

  const filterKeys = slot.filterKeys;

  if (!roleByActor) {
    return actors.some((name) => filterKeys.includes(name));
  }

  return groupByRole(actors, roleByActor).every((group) =>
    group.some((name) => filterKeys.includes(name)),
  );
};
