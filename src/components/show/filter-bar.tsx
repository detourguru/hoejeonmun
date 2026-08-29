"use client";

import { CalendarDays, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useDebouncedCallback } from "@/hook/useDebouncedCallback";
import { useUpdateSearchParams } from "@/hook/useUpdateSearchParams";
import { addMonths, getToday, toInputDate } from "@/lib/date";
import {
  AREA,
  GENRE,
  SEARCHABLE_MONTHS,
  SORT_OPTIONS,
  STATE,
} from "@/type/show";

import { SelectBox } from "../select-box";
import { Input } from "../ui/input";

export const FilterBar = () => {
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const chipsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollFade = () => {
    const el = chipsRef.current;

    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(updateScrollFade, []);

  // 캐싱된 데이터만큼 (SEARCHABLE_MONTHS) pick 가능
  const startOfToday = getToday();
  const today = toInputDate(startOfToday);
  const limit = toInputDate(addMonths(startOfToday, SEARCHABLE_MONTHS));

  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || from;

  const updatePeriod = (key: "from" | "to", value: string) => {
    // value === 연,일,월 세 값이 모두 있어야지 초기화되지 않아서 분기 필요
    if (value) updateSearchParams({ [key]: value });
  };

  // 피커와 방향키만 허용
  const blockTyping = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const isTyping = event.key.length === 1;
    const isClearing = event.key === "Backspace" || event.key === "Delete";

    if (isTyping || isClearing) event.preventDefault();
  };

  const [query, setQuery] = useState(searchParams.get("shprfnm") ?? "");

  const searchByName = useDebouncedCallback(
    (shprfnm: string) => updateSearchParams({ shprfnm }),
    300,
  );

  const dateFieldClassName =
    "h-auto w-auto min-w-0 shrink-0 rounded-none border-0 bg-transparent p-0 text-[13px] font-semibold text-text shadow-none focus-visible:ring-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50";

  return (
    <div className="flex flex-col gap-2.5 pb-2">
      <div className="relative">
        <div
          ref={chipsRef}
          onScroll={updateScrollFade}
          className="scrollbar-hide flex items-center gap-2 overflow-x-scroll"
        >
          <SelectBox
            name="prfstate"
            placeholder="공연 상태"
            options={STATE.options}
          />

          <SelectBox name="shcate" placeholder="장르" options={GENRE.options} />

          <SelectBox
            name="sort"
            placeholder="종료일순"
            options={SORT_OPTIONS}
            alwaysActive
          />

          <SelectBox
            name="signgucode"
            placeholder="지역 구분"
            options={AREA.options}
          />
        </div>

        {canScrollLeft && (
          <div className="from-sub pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r to-transparent" />
        )}

        {canScrollRight && (
          <div className="from-sub pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l to-transparent" />
        )}
      </div>

      <div className="border-border bg-surface focus-within:border-primary/40 flex items-center gap-2.5 rounded-4xl border px-3.5 py-2.5 transition-colors">
        <CalendarDays className="text-primary size-4 shrink-0" />

        <Input
          type="date"
          value={from}
          min={today}
          max={limit}
          onKeyDown={blockTyping}
          onChange={(event) => updatePeriod("from", event.target.value)}
          className={dateFieldClassName}
        />

        <span className="text-text-muted text-xs">~</span>

        <Input
          type="date"
          value={to}
          min={from}
          max={limit}
          onKeyDown={blockTyping}
          onChange={(event) => updatePeriod("to", event.target.value)}
          className={dateFieldClassName}
        />
      </div>

      {/* TODO: 배우 이름 검색 기능 추가 */}
      <div className="border-border bg-surface focus-within:border-primary/40 flex items-center gap-2.5 rounded-full border px-4 py-2.5 transition-colors">
        <Search className="text-text-muted size-4 shrink-0" />

        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            searchByName(event.target.value);
          }}
          placeholder="공연명으로 검색"
          className="h-auto min-w-0 rounded-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
};
