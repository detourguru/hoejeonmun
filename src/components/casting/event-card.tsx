import Link from "next/link";

import { MyEventButton } from "@/components/casting/my-event-button";
import { OriginalImages } from "@/components/casting/original-images";
import { CorrectEventTextButton } from "@/components/correct-event-text-button";
import { DeleteMineButton } from "@/components/delete-mine-button";
import { ReportButton } from "@/components/report-button";
import { getWeekday } from "@/lib/date";
import type { EventWithSlotTimes } from "@/lib/event-slots";

export const EventCard = ({
  event,
  showId,
  showName,
  date,
  showDate = false,
  readOnly = false,
}: {
  event: EventWithSlotTimes;
  showId?: string;
  showName?: string;
  date: string;
  showDate?: boolean;
  readOnly?: boolean;
}) => (
  <li className="bg-point/10 relative rounded p-2">
    {readOnly && showId && (
      <Link
        href={`/show/${showId}/castings`}
        className="absolute inset-0"
        aria-label={`${showName ? `${showName} ` : ""}${event.title}`}
      />
    )}

    {showDate && (
      <p className="text-text text-xs font-bold">
        {date.slice(5).replace("-", ".")}({getWeekday(date)})
      </p>
    )}
    {showName && <p className="text-text-muted text-xs">{showName}</p>}

    <div className="flex items-start justify-between gap-2">
      <p className="text-text text-sm font-bold">{event.title}</p>

      <div className="relative z-10 flex items-center gap-1">
        <MyEventButton
          groupId={event.groupId}
          bookmarked={event.bookmarked}
          date={date}
        />

        {!readOnly && showId && (
          <>
            <CorrectEventTextButton
              showId={showId}
              eventId={event.id}
              initialTitle={event.title}
              initialDescription={event.description}
              initialPeriodStart={event.periodStart}
              initialPeriodEnd={event.periodEnd}
            />

            {event.isMine ? (
              <DeleteMineButton
                target={{ kind: "event", showId, eventId: event.id }}
                label={event.title}
              />
            ) : (
              <ReportButton
                target={{ kind: "event", showId, eventId: event.id }}
                reported={event.reported}
                label={event.title}
              />
            )}
          </>
        )}
      </div>
    </div>

    {!readOnly && event.times && (
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="text-text text-xs font-bold">적용 회차</span>
        {event.times.map((time) => (
          <span
            key={time}
            className="bg-point text-text rounded-full px-2 py-0.5 text-[11px] font-bold"
          >
            {time}
          </span>
        ))}
      </div>
    )}

    {event.description && (
      <p className="text-text-muted mt-1 text-xs">{event.description}</p>
    )}

    {!readOnly && (
      <>
        <p className="text-text-muted mt-1 text-[10px]">
          {event.edited
            ? "제보자가 확인하고 고친 일정이에요"
            : "제보 이미지에서 AI가 읽은 일정이에요"}
        </p>

        <div className="mt-2">
          <OriginalImages images={event.imageUrl ? [event.imageUrl] : []} />
        </div>
      </>
    )}
  </li>
);
