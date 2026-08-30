"use client";

import { useState } from "react";

import { ActorSlotCard } from "@/components/actor/actor-slot-card";
import { CastingViews } from "@/components/casting/casting-views";
import { SLOT_COLOR } from "@/lib/actor-color";
import { cn } from "@/lib/utils";
import { ActorSlot } from "@/service/actor";
import { CastingView } from "@/type/casting";

export const ActorSchedule = ({
  month,
  initialView,
  cells,
  slots,
  shows,
}: {
  month: string;
  initialView: CastingView;
  cells: (string | null)[];
  slots: ActorSlot[];
  shows: { showId: string; showName: string }[];
}) => {
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);

  const toggleShow = (showId: string) => {
    setSelectedShowId((current) => (current === showId ? null : showId));
  };

  const visibleSlots = selectedShowId
    ? slots.filter((slot) => slot.showId === selectedShowId)
    : slots;

  return (
    <>
      {shows.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {shows.map(({ showId, showName }) => (
            <li key={showId}>
              <button
                type="button"
                onClick={() => toggleShow(showId)}
                className={cn(
                  "inline-flex rounded-4xl border px-2.5 py-1 text-xs transition-colors",
                  showId === selectedShowId
                    ? "border-primary bg-primary text-white"
                    : "border-border text-text hover:bg-point",
                )}
              >
                {showName}
              </button>
            </li>
          ))}
        </ul>
      )}

      <CastingViews
        month={month}
        initialView={initialView}
        cells={cells}
        slots={visibleSlots.map((slot) => ({
          id: slot.id,
          date: slot.date,
          time: slot.time,
          label: slot.showName,
          colorClass: SLOT_COLOR,
        }))}
        panels={Object.fromEntries(
          visibleSlots.map((slot) => [
            slot.id,
            <ActorSlotCard key={slot.id} slot={slot} />,
          ]),
        )}
        listItems={Object.fromEntries(
          visibleSlots.map((slot) => [
            slot.id,
            <ActorSlotCard key={slot.id} slot={slot} showDate />,
          ]),
        )}
        empty={
          <p className="text-text-muted py-16 text-center text-sm">
            {selectedShowId
              ? "이 공연으로 좁혀진 회차가 없어요."
              : "이 달에는 등록된 일정이 없어요."}
          </p>
        }
      />
    </>
  );
};
