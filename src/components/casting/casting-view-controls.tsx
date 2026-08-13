"use client";

import { addMonths, parseMonth, toMonth } from "@/lib/date";
import { useUpdateSearchParams } from "@/hook/useUpdateSearchParams";
import { cn } from "@/lib/utils";
import { CASTING_VIEW, CastingView } from "@/type/casting";

export const CastingViewControls = ({
  view,
  month,
}: {
  view: CastingView;
  month: string;
}) => {
  const updateSearchParams = useUpdateSearchParams();

  const moveMonth = (offset: number) => {
    const current = parseMonth(month);

    if (!current) return;

    updateSearchParams({ month: toMonth(addMonths(current, offset)) });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="이전 달"
          className="px-2 py-1 text-sm text-text-muted hover:text-text"
        >
          {`<`}
        </button>

        <p className="text-sm font-bold text-text">
          {month.replace("-", ".")}
        </p>

        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="다음 달"
          className="px-2 py-1 text-sm text-text-muted hover:text-text"
        >
          {`>`}
        </button>
      </div>

      <div className="flex gap-1">
        {CASTING_VIEW.options.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => updateSearchParams({ view: value })}
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
  );
};
