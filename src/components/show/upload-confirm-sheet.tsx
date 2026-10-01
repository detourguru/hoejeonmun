"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { ImageZoom } from "@/components/image-zoom";
import {
  CastingConfirmList,
  CastingDraft,
} from "@/components/show/casting-confirm-list";
import { EventDraft } from "@/components/show/event-confirm-list";
import { EventReview } from "@/components/show/event-review";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REPORT_TYPE_TAB,
  REPORT_TYPE_TAB,
  ReportTypeTab,
} from "@/type/casting";

export const UploadConfirmSheet = ({
  open,
  castingDrafts,
  eventDrafts,
  knownDates,
  knownSlots,
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
  knownSlots: { date: string; time: string }[];
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
            knownSlots={knownSlots}
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
