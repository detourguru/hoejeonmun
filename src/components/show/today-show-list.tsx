"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { TodayShowSlot } from "@/service/casting";
import { LARGE_VENUE_SEAT_THRESHOLD } from "@/type/show";

function isDaehakro(slot: TodayShowSlot) {
  return slot.daehakro === "Y";
}

function isLargeVenue(slot: TodayShowSlot) {
  return slot.seatScale != null && slot.seatScale >= LARGE_VENUE_SEAT_THRESHOLD;
}

function groupByTime(slots: TodayShowSlot[]) {
  const grouped = new Map<string, TodayShowSlot[]>();

  for (const slot of slots) {
    grouped.set(slot.time, [...(grouped.get(slot.time) ?? []), slot]);
  }

  return grouped;
}

export function TodayShowList({
  slots,
  now,
  today,
  month,
}: {
  slots: TodayShowSlot[];
  // HH:mm, 이 시각 이전 회차는 기본적으로 숨긴다
  now: string;
  today: string;
  month: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showDaehakro, setShowDaehakro] = useState(true);
  const [showLargeVenue, setShowLargeVenue] = useState(true);

  const noVenueFilter = !showDaehakro && !showLargeVenue;

  const visibleSlots = slots
    .filter((slot) => showAll || slot.time >= now)
    .filter(
      (slot) =>
        noVenueFilter ||
        (showDaehakro && isDaehakro(slot)) ||
        (showLargeVenue && isLargeVenue(slot)),
    );
  const groupedByTime = groupByTime(visibleSlots);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-text-muted flex w-fit items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={showAll}
            onChange={({ target }) => setShowAll(target.checked)}
          />
          지난 공연도 모두 보기
        </label>

        <div className="flex items-center gap-3">
          <label className="text-text-muted flex w-fit items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={showDaehakro}
              onChange={({ target }) => setShowDaehakro(target.checked)}
            />
            대학로
          </label>

          <label className="text-text-muted flex w-fit items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={showLargeVenue}
              onChange={({ target }) => setShowLargeVenue(target.checked)}
            />
            대극장
          </label>
        </div>
      </div>

      {visibleSlots.length === 0 ? (
        <p className="text-text-muted py-8 text-center text-sm">
          오늘 남은 공연이 없어요
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...groupedByTime.entries()].map(([time, shows]) => (
            <div key={time} className="flex flex-col gap-2">
              <h3 className="text-primary text-sm font-bold">{time}</h3>

              <div className="flex flex-col gap-2">
                {shows.map((slot) => (
                  <Link
                    key={slot.id}
                    href={`/show/${slot.showId}/castings?month=${month}&date=${today}`}
                    className="border-border bg-surface hover:border-primary/40 flex items-stretch gap-3 overflow-hidden rounded-xl border transition-colors"
                  >
                    <div className="bg-point/40 w-14 shrink-0">
                      {slot.poster && (
                        <Image
                          src={slot.poster}
                          alt={slot.showName}
                          width={56}
                          height={80}
                          sizes="56px"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-3 pr-3">
                      <span className="text-text min-w-0 truncate font-medium">
                        {slot.showName}
                      </span>

                      {slot.events.length > 0 && (
                        <span className="text-text-muted max-w-[45%] shrink-0 truncate text-xs">
                          {slot.events[0].title}
                          {slot.events.length > 1
                            ? ` 외 ${slot.events.length - 1}건`
                            : ""}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
