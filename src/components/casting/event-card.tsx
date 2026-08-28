import { OriginalImages } from "@/components/casting/original-images";
import { CorrectEventTextButton } from "@/components/correct-event-text-button";
import { ReportButton } from "@/components/report-button";
import type { EventWithSlotTimes } from "@/lib/event-slots";

export const EventCard = ({
  event,
  showId,
}: {
  event: EventWithSlotTimes;
  showId?: string;
}) => (
  <li className="bg-point/10 rounded p-2">
    <div className="flex items-start justify-between gap-2">
      <p className="text-text text-sm font-bold">{event.title}</p>

      {showId && (
        <div className="flex items-center gap-1">
          <CorrectEventTextButton
            showId={showId}
            eventId={event.id}
            initialTitle={event.title}
            initialDescription={event.description}
          />

          <ReportButton
            target={{ kind: "event", showId, eventId: event.id }}
            reported={event.reported}
            label={event.title}
          />
        </div>
      )}
    </div>

    {event.description && (
      <p className="text-text-muted mt-1 text-xs">{event.description}</p>
    )}
    {event.times && (
      <p className="text-text-muted mt-1 text-[10px]">
        적용 회차: {event.times.join(", ")}
      </p>
    )}
    <p className="text-text-muted mt-1 text-[10px]">
      {event.edited
        ? "제보자가 확인하고 고친 일정이에요"
        : "제보 이미지에서 AI가 읽은 일정이에요"}
    </p>

    <div className="mt-2">
      <OriginalImages images={event.imageUrl ? [event.imageUrl] : []} />
    </div>
  </li>
);
