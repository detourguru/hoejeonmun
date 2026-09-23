"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ActorFilterOption = { value: string; label: string };

export const ActorFilter = ({
  options,
  selected,
  onChange,
}: {
  options: ActorFilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) => {
  const labelOf = (value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Select
        multiple
        items={options}
        value={selected}
        onValueChange={onChange}
      >
        <SelectTrigger size="sm" aria-label="배우로 거르기">
          <SelectValue>
            {(value: string[]) =>
              value.length === 0 ? "배우 선택" : `배우 ${value.length}명`
            }
          </SelectValue>
        </SelectTrigger>

        <SelectContent>
          {options.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(selected.filter((value) => value !== name))}
          className="bg-primary inline-flex shrink-0 items-center gap-1 rounded-4xl px-2.5 py-1 text-xs text-white"
        >
          {labelOf(name)}
          <span aria-hidden>×</span>
          <span className="sr-only">제거</span>
        </button>
      ))}
    </div>
  );
};
