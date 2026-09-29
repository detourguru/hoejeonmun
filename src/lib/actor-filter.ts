import type { CalendarSlot } from "@/type/casting";

// 같은 배역으로 묶인 배우끼리는 그중 한 명만 나와도 되고(OR), 배역이 다르면 전원 나와야(AND) 페어로 본다
function groupByRole(actors: string[], rolesByActor: Map<string, string[]>) {
  const actorsByRole = new Map<string, string[]>();

  for (const actor of actors) {
    const roles = rolesByActor.get(actor);

    for (const role of roles?.length ? roles : [actor]) {
      actorsByRole.set(role, [...(actorsByRole.get(role) ?? []), actor]);
    }
  }

  return [...actorsByRole.values()];
}

export function getRolesByActor(
  roles: { actor: string; role: string }[],
): Map<string, string[]> {
  const rolesByActor = new Map<string, string[]>();

  for (const { actor, role } of roles) {
    const actorRoles = rolesByActor.get(actor) ?? [];

    if (!actorRoles.includes(role)) {
      actorRoles.push(role);
    }

    rolesByActor.set(actor, actorRoles);
  }

  return rolesByActor;
}

// 배역 그룹은 한 번 만들고, 반환한 함수로 각 회차를 검사한다.
export const createActorFilter = (
  actors: string[],
  rolesByActor?: Map<string, string[]>,
) => {
  const groups = rolesByActor ? groupByRole(actors, rolesByActor) : [actors];

  return (slot: Pick<CalendarSlot, "filterKeys">) => {
    // filterKeys가 없는 회차(예: 내 공연)는 항상 보여준다.
    if (!slot.filterKeys || actors.length === 0) return true;

    const filterKeys = slot.filterKeys;

    return groups.every((group) =>
      group.some((name) => filterKeys.includes(name)),
    );
  };
};
