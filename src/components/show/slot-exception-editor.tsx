"use client";

import { Input } from "@/components/ui/input";
import { EventSlotException } from "@/type/casting";

// 기간 막대 밖 별도 포함/기간 안 제외 회차를 원본과 대조해서 고칠 수 있게 하는 목록
export const SlotExceptionEditor = ({
  label,
  items,
  disabled,
  onChange,
}: {
  label: string;
  items: EventSlotException[];
  disabled: boolean;
  onChange: (items: EventSlotException[]) => void;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-text-muted text-xs">{label}</span>

    <ul className="flex flex-col gap-1">
      {items.map((slot, index) => (
        <li key={index} className="flex items-center gap-1">
          <Input
            type="date"
            value={slot.date}
            disabled={disabled}
            aria-label="날짜"
            onChange={({ target }) =>
              onChange(
                items.map((item, at) =>
                  at === index ? { ...item, date: target.value } : item,
                ),
              )
            }
          />
          <Input
            type="time"
            value={slot.time}
            disabled={disabled}
            aria-label="시간"
            onChange={({ target }) =>
              onChange(
                items.map((item, at) =>
                  at === index ? { ...item, time: target.value } : item,
                ),
              )
            }
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(items.filter((_, at) => at !== index))}
            className="text-destructive shrink-0 text-xs disabled:opacity-40"
          >
            삭제
          </button>
        </li>
      ))}
    </ul>

    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange([...items, { date: "", time: "" }])}
      className="border-border text-text-muted w-fit rounded-lg border px-2 py-1 text-[10px] disabled:opacity-40"
    >
      + 회차 추가
    </button>
  </div>
);
