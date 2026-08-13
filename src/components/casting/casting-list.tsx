import { CastingSlot } from "@/service/casting";
import { SlotCard } from "./slot-card";

export const CastingList = ({ slots }: { slots: CastingSlot[] }) => (
  <ul className="flex flex-col gap-2">
    {slots.map((slot) => (
      <SlotCard key={slot.id} slot={slot} showDate />
    ))}
  </ul>
);
