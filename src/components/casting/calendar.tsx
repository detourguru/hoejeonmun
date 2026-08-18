"use client";

import { Fragment, ReactNode, useState } from "react";

import { EventUrlField } from "@/components/casting/event-url-field";
import { WEEKDAYS } from "@/lib/date";
import { getEventColorMap } from "@/lib/event-color";
import { cn } from "@/lib/utils";
import type { ShowEvent } from "@/service/casting";
import { CalendarSlot } from "@/type/casting";

export const Calendar = ({
  cells,
  slots,
  events = [],
  panels,
}: {
  // null이면 1일 앞의 빈칸
  cells: (string | null)[];
  slots: CalendarSlot[];
  events?: ShowEvent[];
  // 날짜를 폈을 때 보여줄 회차 카드
  panels: Record<number, ReactNode>;
}) => {
  const byDate = new Map<string, CalendarSlot[]>();

  for (const slot of slots) {
    byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot]);
  }

  // 회차가 하나도 없는 건 공연이 없는 게 아니라 제보가 아직 없는 것이다
  const knowsSchedule = slots.length > 0;

  const eventsByDate = new Map<string, ShowEvent[]>();

  for (const date of cells) {
    if (!date) continue;
    if (knowsSchedule && !byDate.has(date)) continue;

    const active = events.filter(
      (event) => event.periodStart <= date && date <= event.periodEnd,
    );

    if (active.length > 0) eventsByDate.set(date, active);
  }

  const eventColors = getEventColorMap(events.map((event) => event.id));

  const showTitleFor = new Map<string, Set<number>>();
  let prevDate: string | null = null;
  let prevEventIds = new Set<number>();

  for (const date of cells) {
    if (!date) continue;

    const dayEvents = eventsByDate.get(date) ?? [];
    const shown = new Set<number>();

    for (const event of dayEvents) {
      if (!(prevDate && prevEventIds.has(event.id))) shown.add(event.id);
    }

    showTitleFor.set(date, shown);
    prevDate = date;
    prevEventIds = new Set(dayEvents.map((event) => event.id));
  }

  const hasContent = (date: string) =>
    byDate.has(date) || eventsByDate.has(date);

  const firstFilled = cells.find((date) => date && hasContent(date)) ?? null;

  const [selected, setSelected] = useState<string | null>(firstFilled);

  // 필터를 걸면 원래 보던 날짜가 사라질 수 있다
  const openDate = selected && hasContent(selected) ? selected : firstFilled;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 items-start gap-y-0.5">
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
          const dayEvents = eventsByDate.get(date) ?? [];
          const isEmpty = daySlots.length === 0 && dayEvents.length === 0;

          return (
            <button
              key={date}
              type="button"
              disabled={isEmpty}
              onClick={() => setSelected(date)}
              className={cn(
                "flex min-h-11 flex-col py-0.5",
                isEmpty && "text-text-muted",
                date === openDate && "border-2 border-primary",
              )}
            >
              <span className="self-center text-[10px] leading-none">
                {Number(date.slice(8))}
              </span>
              <div className="flex flex-col">
                {dayEvents.map((event) => (
                  <span
                    key={event.id}
                    className={cn(
                      "truncate px-1 py-px text-[8px] font-bold leading-tight",
                      eventColors.get(event.id),
                    )}
                  >
                    {showTitleFor.get(date)?.has(event.id) ? event.title : " "}
                  </span>
                ))}

                {daySlots.map((slot) => (
                  <span
                    key={slot.id}
                    className={cn(
                      "flex min-w-0 flex-col rounded px-0.5 py-px text-[9px] leading-tight",
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
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {(eventsByDate.get(openDate) ?? []).length > 0 && (
            <ul className="flex flex-col gap-2">
              {(eventsByDate.get(openDate) ?? []).map((event) => (
                <li key={event.id} className="rounded bg-point/10 p-2">
                  <p className="text-sm font-bold text-text">{event.title}</p>
                  {event.description && (
                    <p className="mt-1 text-xs text-text-muted">
                      {event.description}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-text-muted">
                    {event.edited
                      ? "제보자가 확인하고 고친 일정이에요"
                      : "제보 이미지에서 AI가 읽은 일정이에요"}
                  </p>
                  <EventUrlField eventId={event.id} url={event.url} />
                </li>
              ))}
            </ul>
          )}

          <ul className="flex flex-col gap-2">
            {(byDate.get(openDate) ?? []).map((slot) => (
              <Fragment key={slot.id}>{panels[slot.id]}</Fragment>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
