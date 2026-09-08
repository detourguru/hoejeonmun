"use client";

import Link from "next/link";
import { ReactNode } from "react";

import { CastingViews } from "@/components/casting/casting-views";
import type { CalendarEvent } from "@/service/casting";
import { CastingView, CalendarSlot } from "@/type/casting";

export const MyScheduleCalendar = ({
  month,
  initialView,
  cells,
  myEvents,
  mySlots,
  myPanels,
  myListItems,
  favoriteSlots,
  favoritePanels,
  favoriteListItems,
  favoriteActorNames,
}: {
  month: string;
  initialView: CastingView;
  cells: (string | null)[];
  myEvents: CalendarEvent[];
  mySlots: CalendarSlot[];
  myPanels: Record<number, ReactNode>;
  myListItems: Record<number, ReactNode>;
  favoriteSlots: CalendarSlot[];
  favoritePanels: Record<number, ReactNode>;
  favoriteListItems: Record<number, ReactNode>;
  favoriteActorNames: string[];
}) => {
  const hasFavorites = favoriteActorNames.length > 0;

  // 내가 담아둔 회차랑 즐겨찾기 배우 회차가 겹치면 내 공연 쪽으로만 보여준다
  const mySlotIds = new Set(mySlots.map(({ id }) => id));
  const overlaySlots = favoriteSlots.filter(({ id }) => !mySlotIds.has(id));

  return (
    <div className="flex flex-col gap-3">
      {!hasFavorites && (
        <p className="text-text-muted text-xs">
          즐겨찾기한 배우가 없어요.{" "}
          <Link
            href="/mypage/favorite"
            className="text-primary underline underline-offset-2"
          >
            배우 즐겨찾기하러 가기
          </Link>
        </p>
      )}

      <CastingViews
        month={month}
        initialView={initialView}
        cells={cells}
        events={myEvents}
        slots={[...mySlots, ...overlaySlots]}
        panels={{
          ...myPanels,
          ...Object.fromEntries(
            overlaySlots.map(({ id }) => [id, favoritePanels[id]]),
          ),
        }}
        listItems={{
          ...myListItems,
          ...Object.fromEntries(
            overlaySlots.map(({ id }) => [id, favoriteListItems[id]]),
          ),
        }}
        filterOptions={favoriteActorNames}
        filterMode="or"
        empty={
          <p className="text-text-muted py-16 text-center text-sm">
            아직 담아둔 회차/이벤트가 없어요.
          </p>
        }
      />
    </div>
  );
};
