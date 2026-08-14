"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ActorFilter = ({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) => (
  <div className="flex flex-wrap items-center gap-1">
    <Select
      multiple
      items={options.map((name) => ({ label: name, value: name }))}
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
        {options.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    {selected.map((name) => (
      <button
        key={name}
        type="button"
        onClick={() => onChange(selected.filter((value) => value !== name))}
        className="inline-flex shrink-0 items-center gap-1 rounded-4xl bg-primary px-2.5 py-1 text-xs text-white"
      >
        {name}
        <span aria-hidden>×</span>
        <span className="sr-only">제거</span>
      </button>
    ))}
  </div>
);
