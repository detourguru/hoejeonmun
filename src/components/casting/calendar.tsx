"use client";

import { Fragment, ReactNode, useState } from "react";

import { EventCard } from "@/components/casting/event-card";
import { WEEKDAYS } from "@/lib/date";
import { eventAppliesToDate, matchEventsToDate } from "@/lib/event-slots";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/service/casting";
import { CalendarSlot } from "@/type/casting";

type LaneEntry = {
  event: CalendarEvent;
  start: boolean;
  end: boolean;
  length: number;
};

const DAYS_IN_WEEK = 7;
const MAX_VISIBLE_SLOTS = 2;
const MAX_EVENT_LANES = 5;

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
  events?: CalendarEvent[];
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
  const knowsSchedule = !!showId && slots.length > 0;

  const eventsByDate = new Map<string, CalendarEvent[]>();

  for (const date of cells) {
    if (!date) continue;
    if (knowsSchedule && !byDate.has(date)) continue;

    const dateSlots = byDate.get(date) ?? [];
    const active = events.filter((event) =>
      eventAppliesToDate(event, date, dateSlots),
    );

    if (active.length > 0) eventsByDate.set(date, active);
  }

  const isActiveAt = (index: number, eventId: number) => {
    const date = cells[index];

    return (
      !!date && (eventsByDate.get(date) ?? []).some(({ id }) => id === eventId)
    );
  };

  const lanesByIndex = new Map<number, (LaneEntry | null)[]>();
  const hiddenCountByIndex = new Map<number, number>();
  const overflowWeeks = new Set<number>();

  for (let week = 0; week * DAYS_IN_WEEK < cells.length; week += 1) {
    const from = week * DAYS_IN_WEEK;
    const indexes = Array.from(
      { length: DAYS_IN_WEEK },
      (_, offset) => from + offset,
    ).filter((index) => index < cells.length);

    const weekEvents = new Map<number, CalendarEvent>();

    for (const index of indexes) {
      for (const event of eventsByDate.get(cells[index] ?? "") ?? []) {
        weekEvents.set(event.id, event);
      }
    }

    const ordered = [...weekEvents.values()].sort(
      (a, b) =>
        a.periodStart.localeCompare(b.periodStart) ||
        b.periodEnd.localeCompare(a.periodEnd) ||
        a.id - b.id,
    );

    const occupied: Set<number>[] = [];
    const laneOf = new Map<number, number>();

    for (const event of ordered) {
      const span = indexes.filter((index) => isActiveAt(index, event.id));

      let lane = 0;

      while (
        occupied[lane]?.size &&
        span.some((at) => occupied[lane].has(at))
      ) {
        lane += 1;
      }

      occupied[lane] ??= new Set();

      for (const at of span) occupied[lane].add(at);

      laneOf.set(event.id, lane);
    }

    const overflow = occupied.length > MAX_EVENT_LANES;
    const barLanes = overflow ? MAX_EVENT_LANES - 1 : occupied.length;

    if (overflow) overflowWeeks.add(week);

    for (const index of indexes) {
      const date = cells[index];

      if (!date) continue;

      const lanes: (LaneEntry | null)[] = Array.from(
        { length: barLanes },
        () => null,
      );

      let hidden = 0;

      for (const event of eventsByDate.get(date) ?? []) {
        const lane = laneOf.get(event.id) ?? 0;

        if (lane >= barLanes) {
          hidden += 1;
          continue;
        }

        const start = index === from || !isActiveAt(index - 1, event.id);
        const end =
          index === from + DAYS_IN_WEEK - 1 || !isActiveAt(index + 1, event.id);

        let length = 1;

        while (
          start &&
          (index + length) % DAYS_IN_WEEK !== 0 &&
          isActiveAt(index + length, event.id)
        ) {
          length += 1;
        }

        lanes[lane] = { event, start, end, length };
      }

      lanesByIndex.set(index, lanes);

      if (hidden > 0) hiddenCountByIndex.set(index, hidden);
    }
  }

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
      <div className="grid grid-cols-7 gap-y-0.5">
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
                "flex min-h-11 flex-col overflow-hidden py-0.5",
                isEmpty && "text-text-muted",
                date === openDate && "border-primary border-2",
              )}
            >
              <span className="self-center text-[10px] leading-none">
                {Number(date.slice(8))}
              </span>
              <div className="flex flex-col">
                {(lanesByIndex.get(index) ?? []).map((entry, lane) =>
                  entry ? (
                    <span
                      key={entry.event.id}
                      className={cn(
                        "bg-point/50 relative h-3 border-b border-white",
                        entry.start && "ml-px rounded-l-sm",
                        entry.end && "mr-px rounded-r-sm",
                      )}
                    >
                      {entry.start && (
                        <span
                          className="text-text absolute inset-y-0 left-0 z-10 truncate px-1 text-left text-[9px] leading-3 font-bold"
                          style={{ width: `${entry.length * 100}%` }}
                        >
                          {entry.event.title}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span
                      key={`lane-${lane}`}
                      className="h-3 border-b border-transparent"
                    />
                  ),
                )}

                {overflowWeeks.has(Math.floor(index / DAYS_IN_WEEK)) && (
                  <span className="text-text-muted h-3 border-b border-transparent px-1 text-left text-[9px] leading-3">
                    {hiddenCountByIndex.has(index)
                      ? `+${hiddenCountByIndex.get(index)}`
                      : ""}
                  </span>
                )}

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
                <EventCard
                  key={event.id}
                  event={event}
                  showId={event.showId ?? showId}
                  showName={event.showName}
                  date={openDate}
                  readOnly={event.readOnly}
                />
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
