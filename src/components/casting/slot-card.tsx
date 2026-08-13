import Link from "next/link";

import { getWeekday } from "@/lib/date";
import { CastingSlot } from "@/service/casting";

// 매칭 안 된 이름은 링크 없이 그대로 보여준다
const ActorName = ({ actor, actorId }: { actor: string; actorId: number | null }) =>
  actorId === null ? (
    <span className="text-text">{actor}</span>
  ) : (
    <Link
      href={`/actor/${actorId}`}
      className="text-text underline underline-offset-2 hover:text-primary"
    >
      {actor}
    </Link>
  );

export const SlotCard = ({
  slot,
  showDate = false,
}: {
  slot: CastingSlot;
  showDate?: boolean;
}) => (
  <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
    <p className="text-xs font-bold text-text">
      {showDate && (
        <span className="text-text-muted">
          {slot.date.slice(5).replace("-", ".")}({getWeekday(slot.date)}){" "}
        </span>
      )}
      {slot.time}
    </p>

    <dl className="flex flex-col gap-1">
      {slot.casting.map(({ role, actor, actorId }) => (
        <div key={role} className="flex gap-2 text-xs">
          <dt className="w-20 shrink-0 text-text-muted">{role}</dt>
          <dd>
            <ActorName actor={actor} actorId={actorId} />
          </dd>
        </div>
      ))}
    </dl>
  </li>
);
