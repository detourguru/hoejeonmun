import Link from "next/link";

import { MySlotButton } from "@/components/casting/my-slot-button";
import { OriginalImages } from "@/components/casting/original-images";
import { CorrectCastingButton } from "@/components/correct-casting-button";
import { DeleteMineButton } from "@/components/delete-mine-button";
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

export type SlotEventBadge = {
  id: number;
  title: string;
};

export const SlotCard = ({
  slot,
  showId,
  showDate = false,
  events = [],
}: {
  slot: CastingSlotWithStatus;
  showId: string;
  showDate?: boolean;
  events?: SlotEventBadge[];
}) => {
  const { reported, bookmarked, images, isMine } = slot;
  const slotLabel = `${slot.date.slice(5).replace("-", ".")} ${slot.time} 회차`;

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
            date={slot.date}
            time={slot.time}
            castings={slot.casting.map(({ role, actor }) => ({ role, actor }))}
          />

          {isMine ? (
            <DeleteMineButton
              target={{
                kind: "slot",
                showId,
                uploadId: slot.uploadId,
                slotId: slot.id,
              }}
              label={slotLabel}
            />
          ) : (
            <ReportButton
              target={{
                kind: "slot",
                showId,
                uploadId: slot.uploadId,
                slotId: slot.id,
              }}
              reported={reported}
              label={slotLabel}
            />
          )}
        </div>
      </div>

      {events.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {events.map((event) => (
            <li
              key={event.id}
              className="bg-point/20 text-text inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
            >
              {event.title}
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-1">
        {slot.casting.map(({ role, actor, actorId, verified }) => (
          <div key={`${role}-${actor}`} className="flex items-center gap-2 text-xs">
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
