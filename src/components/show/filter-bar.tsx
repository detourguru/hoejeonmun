"use client";

import { useSearchParams } from "next/navigation";

import { STATE_OPTIONS, AREA_OPTIONS } from "@/type/show";
import { useUpdateSearchParams } from "@/hook/useUpdateSearchParams";
import { SelectBox } from "../select-box";
import { Input } from "../ui/input";

export const FilterBar = () => {
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex overflow-x-scroll items-center gap-2 py-2 justify-end">
        <SelectBox
          name="prfstate"
          placeholder="공연 상태"
          options={STATE_OPTIONS}
        />

        <SelectBox
          name="shcate"
          placeholder="장르"
          options={[
            { value: "AAAA", label: "연극" },
            { value: "GGGA", label: "뮤지컬" },
          ]}
        />

        <SelectBox
          name="sort"
          placeholder="기본순"
          options={[
            { value: "openDate", label: "개막일순" },
            { value: "closeDate", label: "종료일순" },
          ]}
        />

        <SelectBox
          name="signgucode"
          placeholder="지역 구분"
          options={AREA_OPTIONS}
        />
      </div>

      {/* TODO: debounce 추가 */}
      <Input
        defaultValue={searchParams.get("shprfnm") ?? ""}
        onChange={(search) =>
          updateSearchParams({ shprfnm: search.target.value })
        }
        placeholder="공연명 | 배우 이름으로 검색"
      />
    </div>
  );
};
