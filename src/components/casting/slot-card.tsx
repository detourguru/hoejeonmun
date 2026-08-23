import Link from "next/link";

import { ReportButton } from "@/components/report-button";
import { getWeekday } from "@/lib/date";
import { CastingSlot, isReported } from "@/service/casting";

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

export const SlotCard = async ({
  slot,
  showId,
  showDate = false,
}: {
  slot: CastingSlot;
  showId: string;
  showDate?: boolean;
}) => {
  const reported = await isReported(slot.uploadId, slot.id);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-text">
          {showDate && (
            <span className="text-text-muted">
              {slot.date.slice(5).replace("-", ".")}({getWeekday(slot.date)}){" "}
            </span>
          )}
          {slot.time}
        </p>

        <ReportButton
          target={{
            kind: "slot",
            showId,
            uploadId: slot.uploadId,
            slotId: slot.id,
          }}
          reported={reported}
          label={`${slot.date.slice(5).replace("-", ".")} ${slot.time} 회차`}
        />
      </div>

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
};
