import Link from "next/link";

import { MySlotButton } from "@/components/casting/my-slot-button";
import { getWeekday } from "@/lib/date";
import type { MySlot } from "@/service/mypage";

export const MySlotCard = ({
  slot,
  showDate = false,
}: {
  slot: MySlot;
  showDate?: boolean;
}) => (
  <li className="border-border bg-surface relative flex flex-col gap-2 rounded-lg border p-3">
    <Link
      href={`/show/${slot.showId}/castings`}
      className="absolute inset-0"
      aria-label={`${slot.showName} ${slot.time}`}
    />

    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-text text-xs font-bold">
          {showDate && (
            <span className="text-text-muted">
              {slot.date.slice(5).replace("-", ".")}({getWeekday(slot.date)}){" "}
            </span>
          )}
          {slot.time}
        </p>

        <p className="text-text text-sm">{slot.showName}</p>
      </div>

      <div className="relative z-10">
        <MySlotButton slotId={slot.id} bookmarked />
      </div>
    </div>

    <dl className="flex flex-col gap-0.5">
      {slot.casting.map(({ role, actor, actorId }) => (
        <div key={role} className="flex gap-2 text-xs">
          <dt className="text-text-muted w-16 shrink-0">{role}</dt>
          <dd className="text-text">
            {actorId === null ? (
              actor
            ) : (
              <Link
                href={`/actor/${actorId}`}
                className="relative z-10 underline underline-offset-2"
              >
                {actor}
              </Link>
            )}
          </dd>
        </div>
      ))}
    </dl>
  </li>
);
