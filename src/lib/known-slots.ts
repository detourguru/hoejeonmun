type Slot = { date: string; time: string };

// DB 회차 시각은 "19:30:00", 업로드 입력은 "19:30"이라 분 단위로 맞춰 합친다
export function mergeKnownSlots(existing: Slot[], drafted: Slot[]): Slot[] {
  const slotByKey = new Map<string, Slot>();

  for (const { date, time } of [...existing, ...drafted]) {
    const shortTime = time.slice(0, 5);

    slotByKey.set(`${date} ${shortTime}`, { date, time: shortTime });
  }

  return [...slotByKey.values()];
}
