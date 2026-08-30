"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  ReactNode,
  useEffect,
  useOptimistic,
  useState,
  useTransition,
} from "react";

import { ActorFilter } from "@/components/casting/actor-filter";
import { Calendar } from "@/components/casting/calendar";
import { EventCard } from "@/components/casting/event-card";
import { useUpdateSearchParams } from "@/hook/useUpdateSearchParams";
import { addMonths, parseMonth, toMonth } from "@/lib/date";
import { eventAppliesToDate, matchEventsToDate } from "@/lib/event-slots";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/service/casting";
import {
  ACTORS_PARAM,
  ACTORS_SEPARATOR,
  CASTING_VIEW,
  CalendarSlot,
  CastingView,
} from "@/type/casting";

const MonthNav = ({
  month,
  pending,
  onMove,
}: {
  month: string;
  pending: boolean;
  onMove: (offset: number) => void;
}) => (
  <div className="flex items-center gap-1">
    <button
      type="button"
      onClick={() => onMove(-1)}
      disabled={pending}
      aria-label="이전 달"
      className="text-text-muted active:text-text disabled:text-border px-2 py-1 text-sm"
    >
      {`<`}
    </button>

    <p className="text-text text-sm font-bold">{month.replace("-", ".")}</p>

    <button
      type="button"
      onClick={() => onMove(1)}
      disabled={pending}
      aria-label="다음 달"
      className="text-text-muted active:text-text disabled:text-border px-2 py-1 text-sm"
    >
      {`>`}
    </button>
  </div>
);

export const CastingViews = ({
  showId,
  month,
  initialView,
  initialDate,
  cells,
  slots,
  events = [],
  panels,
  listItems,
  empty,
  filterOptions = [],
  initialActors = [],
}: {
  showId?: string;
  month: string;
  initialView: CastingView;
  // 특정 날짜(YYYY-MM-DD)를 펴서 보여주고 싶을 때 (예: 이벤트 피드에서 진입)
  initialDate?: string;
  cells: (string | null)[];
  slots: CalendarSlot[];
  events?: CalendarEvent[];
  panels: Record<number, ReactNode>;
  listItems: Record<number, ReactNode>;
  empty?: ReactNode;
  filterOptions?: string[];
  initialActors?: string[];
}) => {
  const [view, setView] = useState<CastingView>(initialView);
  const [actors, setActors] = useState<string[]>(initialActors);
  const [pending, startTransition] = useTransition();
  const [visibleMonth, setVisibleMonth] = useOptimistic(month);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  useEffect(() => {
    const current = parseMonth(month);

    if (!current) return;

    for (const offset of [-1, 1]) {
      const params = new URLSearchParams(searchParams.toString());

      params.delete("page");
      params.set("month", toMonth(addMonths(current, offset)));
      router.prefetch(`${pathname}?${params.toString()}`);
    }
  }, [month, pathname, router, searchParams]);

  const moveMonth = (offset: number) => {
    const current = parseMonth(month);

    if (!current) return;

    const next = toMonth(addMonths(current, offset));

    startTransition(() => {
      setVisibleMonth(next);
      updateSearchParams({ month: next });
    });
  };

  const replaceParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    const query = params.toString();

    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  };

  const changeView = (next: CastingView) => {
    setView(next);
    replaceParams({ view: next });
  };

  const changeActors = (next: string[]) => {
    setActors(next);
    replaceParams({ [ACTORS_PARAM]: next.join(ACTORS_SEPARATOR) });
  };

  // and 조건 조회
  const visible = slots.filter((slot) =>
    actors.every((name) => slot.filterKeys?.includes(name)),
  );

  const isEmpty = slots.length === 0 && events.length === 0;

  const slotDatesSet = new Set(visible.map(({ date }) => date));
  const standaloneEventDates = [
    ...new Set(
      events
        .filter(
          (event) =>
            event.periodStart === event.periodEnd &&
            !slotDatesSet.has(event.periodStart),
        )
        .map((event) => event.periodStart),
    ),
  ];
  const listDates = [...slotDatesSet, ...standaloneEventDates].sort();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <MonthNav month={visibleMonth} pending={pending} onMove={moveMonth} />

        {!isEmpty && (
          <div className="flex gap-1">
            {CASTING_VIEW.options.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => changeView(value)}
                className={cn(
                  "border-border rounded-4xl border px-3 py-1 text-xs transition-colors",
                  value === view ? "bg-primary text-white" : "text-text",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isEmpty && filterOptions.length > 0 && (
        <ActorFilter
          options={filterOptions}
          selected={actors}
          onChange={changeActors}
        />
      )}

      <div
        aria-busy={pending}
        className={cn("transition-opacity", pending && "opacity-40")}
      >
        {isEmpty ? (
          empty
        ) : actors.length > 0 && visible.length === 0 ? (
          <p className="text-text-muted py-16 text-center text-sm">
            {actors.join(", ")} 배우가 함께 나오는 이 달 회차가 없어요.
          </p>
        ) : view === "calendar" ? (
          <Calendar
            showId={showId}
            cells={cells}
            slots={visible}
            events={events}
            panels={panels}
            initialDate={initialDate}
          />
        ) : listDates.length === 0 ? (
          <p className="text-text-muted py-16 text-center text-sm">
            이 달은 아직 회차 정보가 없어요. 달력에서 이벤트를 볼 수 있어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {listDates.map((date) => {
              const daySlots = visible.filter((slot) => slot.date === date);
              const dateEvents = matchEventsToDate(
                daySlots,
                events.filter((event) =>
                  eventAppliesToDate(event, date, daySlots),
                ),
              );

              return (
                <Fragment key={date}>
                  {dateEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      showId={event.showId ?? showId}
                      showName={event.showName}
                      date={date}
                      showDate
                      readOnly={event.readOnly}
                    />
                  ))}
                  {daySlots.map((slot) => (
                    <Fragment key={slot.id}>{listItems[slot.id]}</Fragment>
                  ))}
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
