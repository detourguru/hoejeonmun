"use client";

import { Fragment, ReactNode, useState } from "react";

import { WEEKDAYS } from "@/lib/date";
import { cn } from "@/lib/utils";
import { CalendarEventSummary, CalendarSlot } from "@/type/casting";

export const Calendar = ({
  cells,
  slots,
  events = [],
  panels,
}: {
  // null이면 1일 앞의 빈칸
  cells: (string | null)[];
  slots: CalendarSlot[];
  events?: CalendarEventSummary[];
  // 날짜를 폈을 때 보여줄 회차 카드
  panels: Record<number, ReactNode>;
}) => {
  const byDate = new Map<string, CalendarSlot[]>();

  for (const slot of slots) {
    byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot]);
  }

  const eventByDate = new Map(events.map((event) => [event.date, event]));

  const firstFilled = cells.find((date) => date && byDate.has(date)) ?? null;

  const [selected, setSelected] = useState<string | null>(firstFilled);

  // 필터를 걸면 원래 보던 날짜가 사라질 수 있다
  const openDate = selected && byDate.has(selected) ? selected : firstFilled;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 items-stretch gap-y-0.5">
        {WEEKDAYS.map((weekday) => (
          <p
            key={weekday}
            className="py-1 text-center text-[10px] text-text-muted"
          >
            {weekday}
          </p>
        ))}

        {cells.map((date, index) => {
          if (!date) return <div key={`blank-${index}`} />;

          const daySlots = byDate.get(date) ?? [];
          const dayEvent = eventByDate.get(date);

          return (
            <button
              key={date}
              type="button"
              // 회차가 없는 날은 펼칠 게 없으므로 누를 수 없다
              disabled={daySlots.length === 0}
              onClick={() => setSelected(date)}
              className={cn(
                "flex min-h-11 flex-col py-0.5",
                daySlots.length === 0 && "text-text-muted",
                date === openDate && "ring-2 ring-primary ring-inset",
              )}
            >
              <span className="self-center text-[10px] leading-none">
                {Number(date.slice(8))}
              </span>
              <div className="flex flex-1 flex-col">
                {dayEvent && (
                  <span className="flex flex-1 items-center justify-center truncate bg-point px-1 py-px text-center text-[8px] font-bold leading-tight text-text">
                    이벤트 {dayEvent.title}
                    {dayEvent.count > 1 && ` 외 ${dayEvent.count - 1}건`}
                  </span>
                )}

                {daySlots.map((slot) => (
                  <span
                    key={slot.id}
                    className={cn(
                      "flex min-w-0 flex-1 flex-col justify-center rounded px-0.5 py-px text-[9px] leading-tight",
                      slot.colorClass,
                    )}
                  >
                    <span className="font-bold">{slot.time}</span>
                    <span className="truncate">{slot.label}</span>
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {openDate && (
        <ul className="flex flex-col gap-2 border-t border-border pt-4">
          {(byDate.get(openDate) ?? []).map((slot) => (
            <Fragment key={slot.id}>{panels[slot.id]}</Fragment>
          ))}
        </ul>
      )}
    </div>
  );
};
