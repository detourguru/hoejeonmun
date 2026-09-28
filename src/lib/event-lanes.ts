type LaneInput = {
  id: number;
  periodStart: string;
  periodEnd: string;
  // 한 주 안에서 이벤트가 걸친 칸 위치들
  span: number[];
};

// 일찍 시작하고 길게 이어지는 이벤트부터 가장 위의 빈 레인에 놓아 막대끼리 겹치지 않게 한다
export function assignEventLanes(events: LaneInput[]) {
  const ordered = [...events].sort(
    (a, b) =>
      a.periodStart.localeCompare(b.periodStart) ||
      b.periodEnd.localeCompare(a.periodEnd) ||
      a.id - b.id,
  );

  const occupied: Set<number>[] = [];
  const laneOf = new Map<number, number>();

  for (const event of ordered) {
    let lane = 0;

    while (
      occupied[lane]?.size &&
      event.span.some((at) => occupied[lane].has(at))
    ) {
      lane += 1;
    }

    occupied[lane] ??= new Set();

    for (const at of event.span) occupied[lane].add(at);

    laneOf.set(event.id, lane);
  }

  return { laneOf, laneCount: occupied.length };
}
