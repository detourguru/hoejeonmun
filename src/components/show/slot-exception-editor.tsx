"use client";

import { Input } from "@/components/ui/input";
import { EventSlotException } from "@/type/casting";

const timesOnDate = (
  knownSlots: EventSlotException[] | undefined,
  date: string,
) =>
  [
    ...new Set(
      (knownSlots ?? [])
        .filter((slot) => slot.date === date)
        .map(({ time }) => time.slice(0, 5)),
    ),
  ].sort();

export const SlotExceptionEditor = ({
  label,
  items,
  disabled,
  knownSlots,
  onChange,
}: {
  label: string;
  items: EventSlotException[];
  disabled: boolean;
  knownSlots?: EventSlotException[];
  onChange: (items: EventSlotException[]) => void;
}) => {
  const update = (index: number, next: Partial<EventSlotException>) =>
    onChange(
      items.map((item, at) => (at === index ? { ...item, ...next } : item)),
    );

  const changeDate = (index: number, date: string) => {
    const times = timesOnDate(knownSlots, date);
    const { time } = items[index];

    update(index, {
      date,
      time:
        times.length === 0 || times.includes(time)
          ? time
          : times.length === 1
            ? times[0]
            : "",
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-muted text-xs">{label}</span>

      <ul className="flex flex-col gap-1">
        {items.map((slot, index) => {
          const times = timesOnDate(knownSlots, slot.date);

          return (
            <li key={index} className="flex items-center gap-1">
              <Input
                type="date"
                value={slot.date}
                disabled={disabled}
                aria-label="날짜"
                onChange={({ target }) => changeDate(index, target.value)}
              />
              {times.length > 0 ? (
                <select
                  value={slot.time}
                  disabled={disabled}
                  aria-label="시간"
                  onChange={({ target }) =>
                    update(index, { time: target.value })
                  }
                  className="border-input text-text rounded-control h-10 w-full min-w-0 border bg-transparent px-2 text-base disabled:opacity-50 md:text-sm"
                >
                  <option value="">시간 선택</option>
                  {times.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  type="time"
                  value={slot.time}
                  disabled={disabled}
                  aria-label="시간"
                  onChange={({ target }) =>
                    update(index, { time: target.value })
                  }
                />
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(items.filter((_, at) => at !== index))}
                className="text-destructive shrink-0 text-xs disabled:opacity-40"
              >
                삭제
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...items, { date: "", time: "" }])}
        className="border-border text-text-muted w-fit rounded-lg border px-2 py-1 text-[10px] disabled:opacity-40"
      >
        + 회차 추가
      </button>
    </div>
  );
};
