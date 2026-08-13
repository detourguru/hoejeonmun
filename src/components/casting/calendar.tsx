"use client";

import { ReactNode, useState } from "react";

import { WEEKDAYS } from "@/lib/date";
import { cn } from "@/lib/utils";

export const Calendar = ({
  cells,
  panels,
}: {
  // null이면 1일 앞의 빈칸
  cells: (string | null)[];
  panels: Record<string, ReactNode>;
}) => {
  const firstFilled = cells.find((date) => date && panels[date]) ?? null;

  const [selected, setSelected] = useState<string | null>(firstFilled);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1">
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

          const hasSlots = Boolean(panels[date]);

          return (
            <button
              key={date}
              type="button"
              disabled={!hasSlots}
              onClick={() => setSelected(date)}
              className={cn(
                "flex aspect-square items-center justify-center rounded text-xs transition-colors",
                hasSlots ? "bg-point text-text" : "text-text-muted",
                date === selected && "bg-primary text-white",
              )}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>

      {selected && panels[selected] && (
        <div className="border-t border-border pt-4">{panels[selected]}</div>
      )}
    </div>
  );
};
