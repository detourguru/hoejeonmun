"use client";

import { ReactNode } from "react";

import { CastingViews } from "@/components/casting/casting-views";
import { findOverlappingSlotIds } from "@/lib/schedule-overlap";
import type { CalendarEvent } from "@/service/casting";
import { CastingView, CalendarSlot } from "@/type/casting";

// 내가 담은 회차/이벤트만 보여주는 달력
export const MyScheduleCalendar = ({
  month,
  initialView,
  cells,
  myEvents,
  mySlots,
  myPanels,
  myListItems,
  runtimeByShowId,
}: {
  month: string;
  initialView: CastingView;
  cells: (string | null)[];
  myEvents: CalendarEvent[];
  mySlots: CalendarSlot[];
  myPanels: Record<number, ReactNode>;
  myListItems: Record<number, ReactNode>;
  runtimeByShowId: Record<string, number | null>;
}) => {
  const overlappingIds = findOverlappingSlotIds(
    mySlots.map(({ id, date, time, showId }) => ({
      id,
      date,
      time,
      showId: showId ?? "",
    })),
    runtimeByShowId,
  );

  return (
    <CastingViews
      month={month}
      initialView={initialView}
      cells={cells}
      events={myEvents}
      slots={mySlots}
      panels={myPanels}
      listItems={myListItems}
      overlapFilter={{ overlappingIds }}
      empty={
        <p className="text-text-muted py-16 text-center text-sm">
          아직 담아둔 회차/이벤트가 없어요.
        </p>
      }
    />
  );
};
