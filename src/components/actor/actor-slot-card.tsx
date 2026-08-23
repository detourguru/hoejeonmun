import Link from "next/link";

import { getWeekday } from "@/lib/date";
import { ActorSlot } from "@/service/actor";

export const ActorSlotCard = ({
  slot,
  showDate = false,
}: {
  slot: ActorSlot;
  showDate?: boolean;
}) => (
  <li className="border-border bg-surface rounded-lg border p-3">
    <Link
      href={`/show/${slot.showId}/castings`}
      className="flex flex-col gap-1"
    >
      <p className="text-text text-xs font-bold">
        {showDate && (
          <span className="text-text-muted">
            {slot.date.slice(5).replace("-", ".")}({getWeekday(slot.date)}){" "}
          </span>
        )}
        {slot.time}
      </p>

      <p className="text-text text-sm">{slot.showName}</p>
      <p className="text-text-muted text-xs">{slot.role}</p>
    </Link>
  </li>
);
