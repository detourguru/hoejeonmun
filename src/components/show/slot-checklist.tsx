import { toShortDate } from "@/lib/date";
import {
  createSlotChecker,
  SlotRules,
  slotKey,
  toggleExcludedSlot,
} from "@/lib/event-period";
import { EventSlotException } from "@/type/casting";

export const SlotChecklist = ({
  slots,
  disabled,
  onChange,
  ...rules
}: SlotRules & {
  slots: { date: string; time: string }[];
  disabled: boolean;
  onChange: (excludedSlots: EventSlotException[]) => void;
}) => {
  const isChecked = createSlotChecker(rules);

  const toggle = (slot: { date: string; time: string }) =>
    onChange(toggleExcludedSlot(slots, isChecked, slot));

  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-muted text-xs">
        적용 회차 (기본 전체 적용, 빠지는 회차만 체크 해제해주세요)
      </span>

      {slots.length === 0 ? (
        <p className="text-text-muted text-xs">기간 내 등록된 회차가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {slots.map((slot) => (
            <li key={slotKey(slot)}>
              <label className="text-text flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={isChecked(slot)}
                  disabled={disabled}
                  onChange={() => toggle(slot)}
                />
                {toShortDate(slot.date)} {slot.time}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
