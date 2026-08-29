"use client";

import { useSearchParams } from "next/navigation";

import { useUpdateSearchParams } from "@/hook/useUpdateSearchParams";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const ALL = "";

export const SelectBox = ({
  name,
  options,
  placeholder = "전체",
  alwaysActive = false,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  // 정렬처럼 "선택 안 함" 상태가 없는 필터용 — 항상 강조 표시
  alwaysActive?: boolean;
}) => {
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const items = [{ value: ALL, label: placeholder }, ...options];
  const value = searchParams.get(name) ?? ALL;
  const isActive = alwaysActive || value !== ALL;

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(value) => updateSearchParams({ [name]: value })}
    >
      <SelectTrigger className="border-border bg-surface text-text h-auto shrink-0 gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold">
        {isActive && (
          <span className="bg-point size-1.5 shrink-0 rounded-full" />
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(({ value, label }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
