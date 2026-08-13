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
  <li className="rounded-lg border border-border bg-surface p-3">
    <Link href={`/show/${slot.showId}/castings`} className="flex flex-col gap-1">
      <p className="text-xs font-bold text-text">
        {showDate && (
          <span className="text-text-muted">
            {slot.date.slice(5).replace("-", ".")}({getWeekday(slot.date)}){" "}
          </span>
        )}
        {slot.time}
      </p>

      <p className="text-sm text-text">{slot.showName}</p>
      <p className="text-xs text-text-muted">{slot.role}</p>
    </Link>
  </li>
);
