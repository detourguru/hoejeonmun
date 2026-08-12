"use client";

import { useSearchParams } from "next/navigation";

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

  const searchByName = useDebouncedCallback(
    (shprfnm: string) => updateSearchParams({ shprfnm }),
    300,
  );

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex overflow-x-scroll items-center gap-2 py-2 justify-end">
        <SelectBox
          name="prfstate"
          placeholder="공연 상태"
          options={STATE.options}
        />

        <SelectBox name="shcate" placeholder="장르" options={GENRE.options} />

        <SelectBox
          name="sort"
          placeholder="개막일순"
          options={SORT_OPTIONS}
        />

        <SelectBox
          name="signgucode"
          placeholder="지역 구분"
          options={AREA.options}
        />
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={from}
          min={today}
          max={limit}
          onKeyDown={blockTyping}
          onChange={(event) => updatePeriod("from", event.target.value)}
        />

        <span className="text-text-muted">~</span>

        <Input
          type="date"
          value={to}
          min={from}
          max={limit}
          onKeyDown={blockTyping}
          onChange={(event) => updatePeriod("to", event.target.value)}
        />
      </div>

      {/* TODO: 배우 이름 검색 기능 추가 */}
      <Input
        defaultValue={searchParams.get("shprfnm") ?? ""}
        onChange={(search) => searchByName(search.target.value)}
        placeholder="공연명으로 검색"
      />
    </div>
  );
};
