import Link from "next/link";

import { MySlotButton } from "@/components/casting/my-slot-button";
import { OriginalImages } from "@/components/casting/original-images";
import { CorrectCastingButton } from "@/components/correct-casting-button";
import { ReportButton } from "@/components/report-button";
import { getWeekday } from "@/lib/date";
import type { CastingSlotWithStatus } from "@/service/casting";

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

export const SlotCard = ({
  slot,
  showId,
  showDate = false,
}: {
  slot: CastingSlotWithStatus;
  showId: string;
  showDate?: boolean;
}) => {
  const { reported, bookmarked, images } = slot;

  return (
    <li className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-text flex items-center gap-1.5 text-xs font-bold">
          {showDate && (
            <span className="text-text-muted">
              {slot.date.slice(5).replace("-", ".")}({getWeekday(slot.date)}
              ){" "}
            </span>
          )}
          {slot.time}
          {slot.uploadSource === "system" && (
            <span className="border-border text-text-muted inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-normal">
              시스템 업로드
            </span>
          )}
        </p>

        <div className="flex items-center gap-1">
          <MySlotButton slotId={slot.id} bookmarked={bookmarked} />

          <CorrectCastingButton
            showId={showId}
            slotId={slot.id}
            roles={slot.casting.map(({ role }) => role)}
          />

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
      </div>

      <dl className="flex flex-col gap-1">
        {slot.casting.map(({ role, actor, actorId, verified }) => (
          <div key={role} className="flex items-center gap-2 text-xs">
            <dt className="text-text-muted w-20 shrink-0">{role}</dt>
            <dd className="flex items-center gap-1.5">
              <ActorName actor={actor} actorId={actorId} />
              {!verified && (
                <span className="border-border text-text-muted inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[10px]">
                  텍스트 제보
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <OriginalImages images={images} />
    </li>
  );
};
