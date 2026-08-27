"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { ImageZoom } from "@/components/image-zoom";
import {
  CastingConfirmList,
  CastingDraft,
} from "@/components/show/casting-confirm-list";
import { EventDraft } from "@/components/show/event-confirm-list";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REPORT_TYPE_TAB,
  EVENT_CONFIRM_MESSAGE,
  EventSlotException,
  REPORT_TYPE_TAB,
  ReportTypeTab,
} from "@/type/casting";

export const UploadConfirmSheet = ({
  open,
  castingDrafts,
  eventDrafts,
  knownDates,
  previewUrls,
  saving,
  error,
  initialTab = DEFAULT_REPORT_TYPE_TAB,
  onCastingChange,
  onEventChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  castingDrafts: CastingDraft[];
  eventDrafts: EventDraft[];
  knownDates: Set<string>;
  previewUrls: string[];
  saving: boolean;
  error: string | null;
  initialTab?: ReportTypeTab;
  onCastingChange: (drafts: CastingDraft[]) => void;
  onEventChange: (drafts: EventDraft[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const [tab, setTab] = useState(initialTab);
  const [eventIndex, setEventIndex] = useState(0);

  const draft = eventDrafts[eventIndex];

  const updateEventDraft = (next: Partial<EventDraft>) => {
    onEventChange(
      eventDrafts.map((eventDraft, index) =>
        index === eventIndex ? { ...eventDraft, ...next } : eventDraft,
      ),
    );
  };

  const updateEvent = (next: Partial<EventDraft["event"]>) => {
    if (!draft) return;

    updateEventDraft({ event: { ...draft.event, ...next } });
  };

  const showCasting = castingDrafts.length > 0;
  const showEvents = eventDrafts.length > 0;

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next, eventDetails) => {
        if (!next) eventDetails.cancel();
      }}
      title="읽어낸 내용 확인"
    >
      <div className="flex flex-col gap-3">
        {showCasting && showEvents && (
          <div className="flex gap-1">
            {REPORT_TYPE_TAB.options.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "border-border rounded-lg border px-3 py-1 text-xs",
                  value === tab ? "bg-primary text-surface" : "text-text",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === "casting" && showCasting && (
          <>
            <p className="text-text-muted text-xs">
              원본과 대조해 날짜, 시간, 배역과 배우 이름을 확인해 주세요.
            </p>

            <ul className="flex flex-wrap gap-2">
              {previewUrls.map((url, index) => (
                <li key={url} className="w-20">
                  <ImageZoom
                    src={url}
                    alt={`${index + 1}번째 원본 이미지`}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                </li>
              ))}
            </ul>

            <CastingConfirmList
              drafts={castingDrafts}
              onChange={onCastingChange}
            />
          </>
        )}

        {tab === "event" && draft && (
          <EventReview
            draft={draft}
            index={eventIndex}
            count={eventDrafts.length}
            knownDates={knownDates}
            previewUrl={previewUrls[draft.event.imageIndex]}
            onDraftChange={updateEventDraft}
            onEventChange={updateEvent}
          />
        )}

        {error && <p className="text-destructive text-xs">{error}</p>}

        <p className="text-text-muted text-xs">
          AI가 이미지에서 읽어낸 값이라 틀릴 수 있어요. 저장하면 다른 사람에게
          그대로 보여요.
        </p>

        <div className="flex gap-2">
          {tab === "event" && showEvents ? (
            <>
              <button
                type="button"
                onClick={() => setEventIndex(eventIndex - 1)}
                disabled={eventIndex === 0 || saving}
                className="border-border text-text rounded-lg border px-4 py-2 text-xs disabled:opacity-40"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => {
                  if (eventIndex < eventDrafts.length - 1) {
                    setEventIndex(eventIndex + 1);
                    return;
                  }

                  onConfirm();
                }}
                disabled={saving}
                className="bg-point text-text flex-1 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-60"
              >
                {saving
                  ? "저장하는 중…"
                  : eventIndex === eventDrafts.length - 1
                    ? "이대로 저장하기"
                    : "다음"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="border-border text-text-muted flex-1 rounded-lg border py-2 text-xs disabled:opacity-40"
              >
                제보 취소
              </button>
              <button
                type="button"
                onClick={() => (showEvents ? setTab("event") : onConfirm())}
                disabled={saving}
                className="bg-point text-text flex-1 rounded-lg py-2 text-xs font-bold disabled:opacity-60"
              >
                {showEvents ? "이벤트 확인하기" : "이대로 저장하기"}
              </button>
            </>
          )}
        </div>

        {tab === "event" && eventIndex < eventDrafts.length - 1 && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="text-text-muted text-xs underline underline-offset-2 disabled:opacity-50"
          >
            남은 {eventDrafts.length - eventIndex - 1}건은 확인하지 않고
            저장하기
          </button>
        )}
      </div>
    </BottomSheet>
  );
};

// 기간 밖 별도 포함/기간 안 제외 회차를 원본과 대조해서 고칠 수 있게 하는 목록
const SlotExceptionEditor = ({
  label,
  items,
  disabled,
  onChange,
}: {
  label: string;
  items: EventSlotException[];
  disabled: boolean;
  onChange: (items: EventSlotException[]) => void;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-text-muted text-xs">{label}</span>

    <ul className="flex flex-col gap-1">
      {items.map((slot, index) => (
        <li key={index} className="flex items-center gap-1">
          <Input
            type="date"
            value={slot.date}
            disabled={disabled}
            aria-label="날짜"
            onChange={({ target }) =>
              onChange(
                items.map((item, at) =>
                  at === index ? { ...item, date: target.value } : item,
                ),
              )
            }
          />
          <Input
            type="time"
            value={slot.time}
            disabled={disabled}
            aria-label="시간"
            onChange={({ target }) =>
              onChange(
                items.map((item, at) =>
                  at === index ? { ...item, time: target.value } : item,
                ),
              )
            }
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(items.filter((_, at) => at !== index))}
            className="text-destructive shrink-0 text-xs disabled:opacity-40"
          >
            삭제
          </button>
        </li>
      ))}
    </ul>

    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange([...items, { date: "", time: "" }])}
      className="border-border text-text-muted w-fit rounded-lg border px-2 py-1 text-[10px] disabled:opacity-40"
    >
      + 회차 추가
    </button>
  </div>
);

// periodStart~periodEnd 중 공연이 없는 날
function datesWithoutSchedule(
  periodStart: string,
  periodEnd: string,
  knownDates: Set<string>,
): string[] {
  if (!periodStart || !periodEnd || periodStart > periodEnd) return [];

  const missing: string[] = [];
  let cursor = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);

    if (!knownDates.has(iso)) missing.push(iso);

    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return missing;
}

const toShortDate = (iso: string) =>
  `${Number(iso.slice(5, 7))}/${Number(iso.slice(8))}`;

const EventReview = ({
  draft,
  index,
  count,
  knownDates,
  previewUrl,
  onDraftChange,
  onEventChange,
}: {
  draft: EventDraft;
  index: number;
  count: number;
  knownDates: Set<string>;
  previewUrl?: string;
  onDraftChange: (next: Partial<EventDraft>) => void;
  onEventChange: (next: Partial<EventDraft["event"]>) => void;
}) => {
  const { event, include, replacesGroupId } = draft;
  const datesWithNoShow = datesWithoutSchedule(
    event.periodStart,
    event.periodEnd,
    knownDates,
  );
  const replacing = event.overlapping.find(
    ({ groupId }) => groupId === replacesGroupId,
  );
  const periodChanges =
    replacing &&
    (replacing.periodStart !== event.periodStart ||
      replacing.periodEnd !== event.periodEnd);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text text-sm font-bold">
        이벤트 {index + 1} / {count}
      </p>

      {previewUrl && (
        <div className="border-border bg-sub rounded-lg border p-3">
          <ImageZoom
            src={previewUrl}
            alt={`${index + 1}번째 이벤트를 읽어낸 이미지`}
            className="mx-auto max-h-40 w-auto rounded-lg object-contain"
          />
          <p className="text-text-muted pt-2 text-center text-xs">
            탭하면 크게 볼 수 있어요
          </p>
        </div>
      )}

      {event.confirmReasons.length > 0 && (
        <ul className="bg-point/20 flex flex-col gap-0.5 rounded-lg p-2">
          {event.confirmReasons.map((reason) => (
            <li key={reason} className="text-text text-xs">
              {EVENT_CONFIRM_MESSAGE[reason]}
            </li>
          ))}
        </ul>
      )}

      <label className="text-text-muted flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={include}
          onChange={({ target }) => onDraftChange({ include: target.checked })}
        />
        이 이벤트를 저장할게요
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-muted text-xs">이벤트 이름</span>
        <Input
          value={event.title}
          disabled={!include}
          onChange={({ target }) => onEventChange({ title: target.value })}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-text-muted text-xs">기간</span>
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={event.periodStart}
            disabled={!include}
            aria-label="시작일"
            onChange={({ target }) =>
              onEventChange({ periodStart: target.value })
            }
          />
          <span className="text-text-muted text-xs">~</span>
          <Input
            type="date"
            value={event.periodEnd}
            disabled={!include}
            aria-label="종료일"
            onChange={({ target }) =>
              onEventChange({ periodEnd: target.value })
            }
          />
        </div>
      </div>

      {event.periodStart > event.periodEnd && (
        <p className="text-destructive text-xs">시작일이 종료일보다 늦어요.</p>
      )}

      {datesWithNoShow.length > 0 && (
        <p className="text-text-muted text-xs">
          공연 없음: {datesWithNoShow.map(toShortDate).join(", ")}
        </p>
      )}

      {event.source === "notice" && (
        <>
          <SlotExceptionEditor
            label="기간 막대 밖에서 추가로 포함되는 회차 (원본과 대조해주세요)"
            items={event.includedSlots ?? []}
            disabled={!include}
            onChange={(items) => onEventChange({ includedSlots: items })}
          />

          <SlotExceptionEditor
            label="기간 안에서 제외되는 회차 (원본과 대조해주세요)"
            items={event.excludedSlots ?? []}
            disabled={!include}
            onChange={(items) => onEventChange({ excludedSlots: items })}
          />
        </>
      )}

      {event.overlapping.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-text-muted text-xs">
            이미 등록된 이벤트와의 관계
          </span>
          <select
            value={replacesGroupId ?? ""}
            disabled={!include}
            className="border-input text-text h-9 rounded-lg border bg-transparent px-2 text-xs disabled:opacity-50"
            onChange={({ target }) =>
              onDraftChange({
                replacesGroupId: target.value
                  ? Number(target.value)
                  : undefined,
              })
            }
          >
            <option value="">따로 있는 이벤트예요</option>
            {event.overlapping.map((existing) => (
              <option key={existing.id} value={existing.groupId}>
                {existing.title} ({existing.periodStart} ~ {existing.periodEnd}
                )와 같은 이벤트예요
              </option>
            ))}
          </select>
        </label>
      )}

      {include && periodChanges && (
        <p className="bg-point/20 text-text rounded-lg p-2 text-xs">
          저장하면 이미 등록된 {replacing.periodStart} ~ {replacing.periodEnd}
          대신 {event.periodStart} ~ {event.periodEnd}가 보여요.
        </p>
      )}

      {event.description && (
        <p className="text-text-muted text-xs">{event.description}</p>
      )}
    </div>
  );
};
