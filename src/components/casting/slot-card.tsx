import Link from "next/link";

import { OriginalImages } from "@/components/casting/original-images";
import { ReportButton } from "@/components/report-button";
import { getWeekday } from "@/lib/date";
import { CastingSlot, getUploadImages, isReported } from "@/service/casting";

// 매칭 안 된 이름은 링크 없이 그대로 보여준다
const ActorName = ({
  actor,
  actorId,
}: {
  actor: string;
  actorId: number | null;
}) =>
  actorId === null ? (
    <span className="text-text">{actor}</span>
  ) : (
    <Link
      href={`/actor/${actorId}`}
      className="text-text hover:text-primary underline underline-offset-2"
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
  const [reported, images] = await Promise.all([
    isReported(slot.uploadId, slot.id),
    getUploadImages(slot.uploadId),
  ]);

  return (
    <li className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-text text-xs font-bold">
          {showDate && (
            <span className="text-text-muted">
              {slot.date.slice(5).replace("-", ".")}({getWeekday(slot.date)}
              ){" "}
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
            <dt className="text-text-muted w-20 shrink-0">{role}</dt>
            <dd>
              <ActorName actor={actor} actorId={actorId} />
            </dd>
          </div>
        ))}
      </dl>

      <OriginalImages images={images} />
    </li>
  );
};
