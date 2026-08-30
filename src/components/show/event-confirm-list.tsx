"use client";

import { Input } from "@/components/ui/input";
import {
  ConfirmedEvent,
  EVENT_CONFIRM_MESSAGE,
  EventSlotException,
  PendingEvent,
} from "@/type/casting";

export type EventDraft = {
  event: PendingEvent;
  original: PendingEvent;
  include: boolean;
  replacesGroupId?: number;
};

// 날짜순으로 붙어 있어야 중복 이벤트가 눈에 바로 띈다
const byPeriod = (a: PendingEvent, b: PendingEvent) => {
  const keyA = a.periodStart + a.periodEnd;
  const keyB = b.periodStart + b.periodEnd;

  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
};

export const toEventDrafts = (events: PendingEvent[]): EventDraft[] =>
  [...events].sort(byPeriod).map((event) => ({
    event,
    original: event,
    include: true,
    replacesGroupId: event.suggestedSameAsGroupId,
  }));

const sameSlots = (a?: EventSlotException[], b?: EventSlotException[]) =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

const sameTimes = (a?: string[], b?: string[]) =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

export const toConfirmedEvents = (drafts: EventDraft[]): ConfirmedEvent[] =>
  drafts
    .filter(({ include }) => include)
    .map(({ event, original, replacesGroupId }) => ({
      ...event,
      confirmed: true,
      edited:
        event.title !== original.title ||
        event.periodStart !== original.periodStart ||
        event.periodEnd !== original.periodEnd ||
        !sameSlots(event.includedSlots, original.includedSlots) ||
        !sameSlots(event.excludedSlots, original.excludedSlots) ||
        !sameTimes(event.exactTimes, original.exactTimes),
      replacesGroupId,
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
      {drafts.map(({ event, include, replacesGroupId }, index) => (
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
              value={replacesGroupId ?? ""}
              disabled={!include}
              aria-label="이미 등록된 이벤트와의 관계"
              className="border-input text-text h-8 rounded-lg border bg-transparent px-2 text-xs disabled:opacity-50"
              onChange={({ target }) =>
                update(index, {
                  replacesGroupId: target.value
                    ? Number(target.value)
                    : undefined,
                })
              }
            >
              <option value="">따로 있는 이벤트예요</option>
              {event.overlapping.map((existing) => (
                <option key={existing.id} value={existing.groupId}>
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
