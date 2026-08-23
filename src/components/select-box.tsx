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
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}) => {
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const items = [{ value: ALL, label: placeholder }, ...options];

  return (
    <Select
      items={items}
      value={searchParams.get(name) ?? ALL}
      onValueChange={(value) => updateSearchParams({ [name]: value })}
    >
      <SelectTrigger className="w-32">
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
