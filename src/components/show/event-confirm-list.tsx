"use client";

import { Input } from "@/components/ui/input";
import {
  ConfirmedEvent,
  EVENT_CONFIRM_MESSAGE,
  PendingEvent,
} from "@/type/casting";

export type EventDraft = {
  event: PendingEvent;
  original: PendingEvent;
  include: boolean;
  replacesEventId?: number;
};

export const toEventDrafts = (events: PendingEvent[]): EventDraft[] =>
  events.map((event) => ({
    event,
    original: event,
    include: true,
    replacesEventId: event.suggestedSameAsId,
  }));

export const toConfirmedEvents = (drafts: EventDraft[]): ConfirmedEvent[] =>
  drafts
    .filter(({ include }) => include)
    .map(({ event, original, replacesEventId }) => ({
      ...event,
      confirmed: true,
      edited:
        event.title !== original.title ||
        event.periodStart !== original.periodStart ||
        event.periodEnd !== original.periodEnd,
      replacesEventId,
    }));

export const EventConfirmList = ({
  drafts,
  onChange,
}: {
  drafts: EventDraft[];
  onChange: (drafts: EventDraft[]) => void;
}) => {
  const update = (index: number, next: Partial<EventDraft>) =>
    onChange(
      drafts.map((draft, at) => (at === index ? { ...draft, ...next } : draft)),
    );

  const updateEvent = (index: number, next: Partial<PendingEvent>) =>
    update(index, { event: { ...drafts[index].event, ...next } });

  return (
    <ul className="flex flex-col gap-3">
      {drafts.map(({ event, include, replacesEventId }, index) => (
        <li
          key={`${event.source}-${event.imageIndex}-${index}`}
          className="border-border flex flex-col gap-2 rounded-lg border p-3"
        >
          <label className="text-text flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={include}
              onChange={({ target }) =>
                update(index, { include: target.checked })
              }
            />
            이 이벤트를 저장할게요
          </label>

          {event.confirmReasons.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {event.confirmReasons.map((reason) => (
                <li key={reason} className="text-destructive text-xs">
                  {EVENT_CONFIRM_MESSAGE[reason]}
                </li>
              ))}
            </ul>
          )}

          <Input
            value={event.title}
            disabled={!include}
            aria-label="이벤트 이름"
            onChange={({ target }) =>
              updateEvent(index, { title: target.value })
            }
          />

          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={event.periodStart}
              disabled={!include}
              aria-label="시작일"
              onChange={({ target }) =>
                updateEvent(index, { periodStart: target.value })
              }
            />
            <span className="text-text-muted text-xs">~</span>
            <Input
              type="date"
              value={event.periodEnd}
              disabled={!include}
              aria-label="종료일"
              onChange={({ target }) =>
                updateEvent(index, { periodEnd: target.value })
              }
            />
          </div>

          {event.periodStart > event.periodEnd && (
            <p className="text-destructive text-xs">
              시작일이 종료일보다 늦어요.
            </p>
          )}

          {event.overlapping.length > 0 && (
            <select
              value={replacesEventId ?? ""}
              disabled={!include}
              aria-label="이미 등록된 이벤트와의 관계"
              className="border-input text-text h-8 rounded-lg border bg-transparent px-2 text-xs disabled:opacity-50"
              onChange={({ target }) =>
                update(index, {
                  replacesEventId: target.value
                    ? Number(target.value)
                    : undefined,
                })
              }
            >
              <option value="">따로 있는 이벤트예요</option>
              {event.overlapping.map((existing) => (
                <option key={existing.id} value={existing.id}>
                  {existing.title} ({existing.periodStart} ~{" "}
                  {existing.periodEnd})와 같은 이벤트예요
                </option>
              ))}
            </select>
          )}

          {event.description && (
            <p className="text-text-muted text-xs">{event.description}</p>
          )}
        </li>
      ))}
    </ul>
  );
};
