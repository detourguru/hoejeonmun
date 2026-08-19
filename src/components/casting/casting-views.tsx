"use client";

import { Fragment, ReactNode, useState } from "react";

import { ActorFilter } from "@/components/casting/actor-filter";
import { Calendar } from "@/components/casting/calendar";
import { useUpdateSearchParams } from "@/hook/useUpdateSearchParams";
import { addMonths, parseMonth, toMonth } from "@/lib/date";
import { appliesToSession, getSessionBySlotId } from "@/lib/event-session";
import { cn } from "@/lib/utils";
import type { ShowEvent } from "@/service/casting";
import {
  ACTORS_PARAM,
  ACTORS_SEPARATOR,
  CASTING_VIEW,
  CalendarSlot,
  CastingView,
  EVENT_SESSION,
} from "@/type/casting";

// 조회해오지 않은 달로 넘어갔을때 DB에서 조회가 필요하므로 별도로 분리
export const MonthNav = ({ month }: { month: string }) => {
  const updateSearchParams = useUpdateSearchParams();

  const moveMonth = (offset: number) => {
    const current = parseMonth(month);

    if (!current) return;

    updateSearchParams({ month: toMonth(addMonths(current, offset)) });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => moveMonth(-1)}
        aria-label="이전 달"
        className="px-2 py-1 text-sm text-text-muted hover:text-text"
      >
        {`<`}
      </button>

      <p className="text-sm font-bold text-text">{month.replace("-", ".")}</p>

      <button
        type="button"
        onClick={() => moveMonth(1)}
        aria-label="다음 달"
        className="px-2 py-1 text-sm text-text-muted hover:text-text"
      >
        {`>`}
      </button>
    </div>
  );
};

export const CastingViews = ({
  month,
  initialView,
  initialDate,
  cells,
  slots,
  events = [],
  panels,
  listItems,
  filterOptions = [],
  initialActors = [],
}: {
  month: string;
  initialView: CastingView;
  // 특정 날짜(YYYY-MM-DD)를 펴서 보여주고 싶을 때 (예: 이벤트 피드에서 진입)
  initialDate?: string;
  cells: (string | null)[];
  slots: CalendarSlot[];
  events?: ShowEvent[];
  panels: Record<number, ReactNode>;
  listItems: Record<number, ReactNode>;
  filterOptions?: string[];
  initialActors?: string[];
}) => {
  const [view, setView] = useState<CastingView>(initialView);
  const [actors, setActors] = useState<string[]>(initialActors);

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

  // 배우 필터를 걸면 그날 마지막 회차가 달라져 낮/밤 판정이 뒤집힌다. 필터 전 전체로 판정한다
  const sessionBySlotId = getSessionBySlotId(slots);

  const eventsForSlot = (slot: CalendarSlot) =>
    events.filter(
      (event) =>
        event.periodStart <= slot.date &&
        slot.date <= event.periodEnd &&
        appliesToSession(event.session, sessionBySlotId.get(slot.id)),
    );

  // and 조건 조회
  const visible = slots.filter((slot) =>
    actors.every((name) => slot.filterKeys?.includes(name)),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <MonthNav month={month} />

        <div className="flex gap-1">
          {CASTING_VIEW.options.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => changeView(value)}
              className={cn(
                "rounded-4xl border border-border px-3 py-1 text-xs transition-colors",
                value === view ? "bg-primary text-white" : "text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filterOptions.length > 0 && (
        <ActorFilter
          options={filterOptions}
          selected={actors}
          onChange={changeActors}
        />
      )}

      {actors.length > 0 && visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-muted">
          {actors.join(", ")} 배우가 함께 나오는 이 달 회차가 없어요.
        </p>
      ) : view === "calendar" ? (
        <Calendar
          cells={cells}
          slots={visible}
          events={events}

          sessionBySlotId={sessionBySlotId}
          panels={panels}
          initialDate={initialDate}
        />
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-muted">
          이 달은 아직 회차 정보가 없어요. 달력에서 이벤트를 볼 수 있어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((slot) => {
            const slotEvents = eventsForSlot(slot);

            return (
              <Fragment key={slot.id}>
                {slotEvents.length > 0 && (
                  <li className="flex flex-wrap gap-1">
                    {slotEvents.map((event) => (
                      <span
                        key={event.id}
                        className="rounded-sm bg-point/50 px-1.5 py-0.5 text-[10px] font-bold text-text"
                      >
                        {event.session
                          ? `[${EVENT_SESSION.nameByCode[event.session]}] `
                          : ""}
                        {event.title}
                      </span>
                    ))}
                  </li>
                )}
                {listItems[slot.id]}
              </Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
};
