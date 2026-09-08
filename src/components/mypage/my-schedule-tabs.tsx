"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";

import { CastingViews } from "@/components/casting/casting-views";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/service/casting";
import { CastingView, CalendarSlot } from "@/type/casting";

type Tab = "mine" | "favorites";

const TABS: { value: Tab; label: string }[] = [
  { value: "mine", label: "내 공연" },
  { value: "favorites", label: "즐겨찾기 배우" },
];

export const MyScheduleTabs = ({
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
  const [tab, setTab] = useState<Tab>("mine");
  const hasFavorites = favoriteActorNames.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "border-border rounded-4xl border px-3 py-1 text-xs transition-colors",
              value === tab ? "bg-primary text-white" : "text-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        <CastingViews
          key="mine"
          month={month}
          initialView={initialView}
          cells={cells}
          events={myEvents}
          slots={mySlots}
          panels={myPanels}
          listItems={myListItems}
          empty={
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-text-muted text-sm">
                아직 담아둔 회차/이벤트가 없어요.
              </p>
            </div>
          }
        />
      ) : (
        <CastingViews
          key="favorites"
          month={month}
          initialView={initialView}
          cells={cells}
          events={[]}
          slots={favoriteSlots}
          panels={favoritePanels}
          listItems={favoriteListItems}
          filterOptions={favoriteActorNames}
          filterMode="or"
          empty={
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-text-muted text-sm">
                {hasFavorites
                  ? "이 달엔 즐겨찾기한 배우의 회차가 없어요."
                  : "아직 즐겨찾기한 배우가 없어요."}
              </p>
              {!hasFavorites && (
                <Link
                  href="/mypage/favorite"
                  className="text-primary text-xs underline underline-offset-2"
                >
                  배우 즐겨찾기하러 가기
                </Link>
              )}
            </div>
          }
        />
      )}
    </div>
  );
};
