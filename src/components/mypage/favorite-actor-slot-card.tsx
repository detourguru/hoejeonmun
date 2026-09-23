import Link from "next/link";

import { getWeekday } from "@/lib/date";
import type { FavoriteActorSlot } from "@/service/actor";

export const FavoriteActorSlotCard = ({
  slot,
  showDate = false,
  displayNameById,
}: {
  slot: FavoriteActorSlot;
  showDate?: boolean;
  displayNameById?: Map<number, string>;
}) => (
  <li className="border-border bg-surface relative flex flex-col gap-2 rounded-lg border p-3">
    <Link
      href={`/show/${slot.showId}/castings`}
      className="absolute inset-0"
      aria-label={`${slot.showName} ${slot.time}`}
    />

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

    <dl className="flex flex-col gap-0.5">
      {slot.casting.map(({ role, actor, actorId }) => (
        <div key={actorId} className="flex gap-2 text-xs">
          <dt className="text-text-muted w-16 shrink-0">{role}</dt>
          <dd className="text-text">
            <Link
              href={`/actor/${actorId}`}
              className="relative z-10 underline underline-offset-2"
            >
              {displayNameById?.get(actorId) ?? actor}
            </Link>
          </dd>
        </div>
      ))}
    </dl>
  </li>
);
