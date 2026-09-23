"use client";

import Link from "next/link";
import { ReactNode } from "react";

import type { ActorFilterOption } from "@/components/casting/actor-filter";
import { CastingViews } from "@/components/casting/casting-views";
import { CastingView, CalendarSlot } from "@/type/casting";

// 애정배우가 나오는 회차만 보여주는 달력
export const FavoriteScheduleCalendar = ({
  month,
  initialView,
  cells,
  favoriteSlots,
  favoritePanels,
  favoriteListItems,
  favoriteActorOptions,
}: {
  month: string;
  initialView: CastingView;
  cells: (string | null)[];
  favoriteSlots: CalendarSlot[];
  favoritePanels: Record<number, ReactNode>;
  favoriteListItems: Record<number, ReactNode>;
  favoriteActorOptions: ActorFilterOption[];
}) => (
  <CastingViews
    month={month}
    initialView={initialView}
    cells={cells}
    slots={favoriteSlots}
    panels={favoritePanels}
    listItems={favoriteListItems}
    filterOptions={favoriteActorOptions}
    empty={
      favoriteActorOptions.length === 0 ? (
        <p className="text-text-muted py-16 text-center text-sm">
          즐겨찾기한 배우가 없어요.{" "}
          <Link
            href="/mypage/favorite"
            className="text-primary underline underline-offset-2"
          >
            배우 즐겨찾기하러 가기
          </Link>
        </p>
      ) : (
        <p className="text-text-muted py-16 text-center text-sm">
          이 달에 애정배우가 나오는 회차가 없어요.
        </p>
      )
    }
  />
);
