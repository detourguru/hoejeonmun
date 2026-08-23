"use client";

import { Fragment, ReactNode, useState } from "react";

import { ReportButton } from "@/components/report-button";
import { WEEKDAYS } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { EventWithReportStatus } from "@/service/casting";
import { CalendarSlot } from "@/type/casting";

type Band = {
  start: boolean;
  end: boolean;
  length: number;
};

const DAYS_IN_WEEK = 7;

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
                {dayEvents.map((event) => {
                  const band = bandsByDate.get(date)?.get(event.id);

                  return (
                    <span
                      key={event.id}
                      className={cn(
                        "relative h-3 bg-point/50 border-b border-white",
                        band?.start && "ml-px rounded-l-sm",
                        band?.end && "mr-px rounded-r-sm",
                      )}
                    >
                      {band?.start && (
                        <span
                          className="absolute inset-y-0 left-0 z-10 truncate px-1 text-left text-[8px] font-bold leading-3 text-text"
                          style={{ width: `${band.length * 100}%` }}
                        >
                          {band.start ? event.title : " "}
                        </span>
                      )}
                    </span>
                  );
                })}

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
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-text">
                      {event.title}
                    </p>

                    {showId && (
                      <ReportButton
                        target={{ kind: "event", showId, eventId: event.id }}
                        reported={event.reported}
                        label={event.title}
                      />
                    )}
                  </div>

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
