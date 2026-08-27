"use client";

import { Fragment, ReactNode, useState } from "react";

import { EventCard } from "@/components/casting/event-card";
import { WEEKDAYS } from "@/lib/date";
import { matchEventsToDate } from "@/lib/event-slots";
import { cn } from "@/lib/utils";
import type { EventWithReportStatus } from "@/service/casting";
import { CalendarSlot } from "@/type/casting";

type Band = {
  start: boolean;
  end: boolean;
  length: number;
};

const DAYS_IN_WEEK = 7;
const MAX_VISIBLE_SLOTS = 2;

export const Calendar = ({
  showId,
  cells,
  slots,
  events = [],
  panels,
  initialDate,
}: {
  showId?: string;
  // null이면 1일 앞의 빈칸
  cells: (string | null)[];
  slots: CalendarSlot[];
  events?: EventWithReportStatus[];
  // 날짜를 폈을 때 보여줄 회차 카드
  panels: Record<number, ReactNode>;
  // 진입 시 보여줄 날짜
  initialDate?: string;
}) => {
  const byDate = new Map<string, CalendarSlot[]>();

  for (const slot of slots) {
    byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot]);
  }

  // 회차가 하나도 없는 건 공연이 없는 게 아니라 제보가 아직 없는 것이다
  const knowsSchedule = slots.length > 0;

  const eventsByDate = new Map<string, EventWithReportStatus[]>();

  for (const date of cells) {
    if (!date) continue;
    if (knowsSchedule && !byDate.has(date)) continue;

    const active = events.filter(
      (event) => event.periodStart <= date && date <= event.periodEnd,
    );

    if (active.length > 0) eventsByDate.set(date, active);
  }

  const isActiveAt = (index: number, eventId: number) => {
    const date = cells[index];

    return (
      !!date && (eventsByDate.get(date) ?? []).some(({ id }) => id === eventId)
    );
  };

  const bandsByDate = new Map<string, Map<number, Band>>();
  const shownEventIds = new Set<number>();

  cells.forEach((date, index) => {
    if (!date) return;

    const bands = new Map<number, Band>();

    for (const { id } of eventsByDate.get(date) ?? []) {
      const start = index % DAYS_IN_WEEK === 0 || !isActiveAt(index - 1, id);
      const end =
        index % DAYS_IN_WEEK === DAYS_IN_WEEK - 1 || !isActiveAt(index + 1, id);

      let length = 1;

      while (
        start &&
        (index + length) % DAYS_IN_WEEK !== 0 &&
        isActiveAt(index + length, id)
      ) {
        length += 1;
      }

      if (start) shownEventIds.add(id);

      bands.set(id, { start, end, length });
    }

    bandsByDate.set(date, bands);
  });

  const hasContent = (date: string) =>
    byDate.has(date) || eventsByDate.has(date);

  const firstFilled = cells.find((date) => date && hasContent(date)) ?? null;

  const [selected, setSelected] = useState<string | null>(
    initialDate && hasContent(initialDate) ? initialDate : firstFilled,
  );

  // 필터를 걸면 원래 보던 날짜가 사라질 수 있다
  const openDate = selected && hasContent(selected) ? selected : firstFilled;

  const openDateSlots = openDate ? (byDate.get(openDate) ?? []) : [];
  const openDateEvents = openDate
    ? matchEventsToDate(openDateSlots, eventsByDate.get(openDate) ?? [])
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 items-start gap-y-0.5">
        {WEEKDAYS.map((weekday) => (
          <p
            key={weekday}
            className="text-text-muted py-1 text-center text-[10px]"
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
                date === openDate && "border-primary border-2",
              )}
            >
              <span className="self-center text-[10px] leading-none">
                {Number(date.slice(8))}
              </span>
              <div className="flex flex-col">
                {dayEvents.map((event) => {
                  const band = bandsByDate.get(date)?.get(event.id);

                  return (
                    <span
                      key={event.id}
                      className={cn(
                        "bg-point/50 relative h-3 border-b border-white",
                        band?.start && "ml-px rounded-l-sm",
                        band?.end && "mr-px rounded-r-sm",
                      )}
                    >
                      {band?.start && (
                        <span
                          className="text-text absolute inset-y-0 left-0 z-10 truncate px-1 text-left text-[9px] leading-3 font-bold"
                          style={{ width: `${band.length * 100}%` }}
                        >
                          {band.start ? event.title : " "}
                        </span>
                      )}
                    </span>
                  );
                })}

                {daySlots.slice(0, MAX_VISIBLE_SLOTS).map((slot) => (
                  <span
                    key={slot.id}
                    className={cn(
                      "flex min-w-0 flex-col rounded px-0.5 py-px text-[10px] leading-tight",
                      slot.colorClass,
                    )}
                  >
                    <span className="font-bold">{slot.time}</span>
                    <span className="truncate">{slot.label}</span>
                  </span>
                ))}

                {daySlots.length > MAX_VISIBLE_SLOTS && (
                  <span className="text-text-muted px-0.5 text-[10px] font-medium">
                    +{daySlots.length - MAX_VISIBLE_SLOTS}건 더
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {openDate && (
        <div className="border-border flex flex-col gap-3 border-t pt-4">
          {openDateEvents.length > 0 && (
            <ul className="flex flex-col gap-2">
              {openDateEvents.map((event) => (
                <EventCard key={event.id} event={event} showId={showId} />
              ))}
            </ul>
          )}

          <ul className="flex flex-col gap-2">
            {openDateSlots.map((slot) => (
              <Fragment key={slot.id}>{panels[slot.id]}</Fragment>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
