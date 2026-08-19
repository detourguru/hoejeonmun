"use client";

import { useEffect, useRef, useState } from "react";

import { ImageZoom } from "@/components/image-zoom";
import { Input } from "@/components/ui/input";
import {
  ConfirmedEvent,
  EVENT_CONFIRM_MESSAGE,
  EVENT_SESSION,
  PendingEvent,
} from "@/type/casting";

export type EventDraft = {
  event: PendingEvent;
  original: PendingEvent;
  include: boolean;
  replacesGroupId?: number;
};

export const toEventDrafts = (events: PendingEvent[]): EventDraft[] =>
  events.map((event) => ({
    event,
    original: event,
    include: true,
    replacesGroupId: event.suggestedSameAsId,
  }));

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
        event.session !== original.session,
      replacesGroupId,
    }));

export const EventConfirmSheet = ({
  open,
  drafts,
  previewUrls,
  saving,
  onChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  drafts: EventDraft[];
  previewUrls: string[];
  saving: boolean;
  onChange: (drafts: EventDraft[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (open && !dialog.open) {
      setIndex(0);
      dialog.showModal();
    }

    if (!open && dialog.open) dialog.close();
  }, [open]);

  const draft = drafts[index];

  if (!draft) return null;

  const { event, include, replacesGroupId } = draft;
  const previewUrl = previewUrls[event.imageIndex];
  const isLast = index === drafts.length - 1;
  const invalidPeriod = event.periodStart > event.periodEnd;

  const replacing = event.overlapping.find(({ id }) => id === replacesGroupId);

  const periodChanges =
    replacing &&
    (replacing.periodStart !== event.periodStart ||
      replacing.periodEnd !== event.periodEnd);

  const update = (next: Partial<EventDraft>) =>
    onChange(
      drafts.map((each, at) => (at === index ? { ...each, ...next } : each)),
    );

  const updateEvent = (next: Partial<PendingEvent>) =>
    update({ event: { ...event, ...next } });

  return (
    <dialog
      ref={dialogRef}
      onCancel={(escape) => escape.preventDefault()}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-2xl bg-surface p-0 backdrop:bg-black/50 sm:mx-auto sm:max-w-md"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="shrink-0 border-b border-border">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <p className="text-sm font-bold text-text">
              읽어낸 이벤트 확인{" "}
              <span className="text-text-muted">
                {index + 1} / {drafts.length}
              </span>
            </p>

            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="text-xs text-text-muted underline underline-offset-2 disabled:opacity-50"
            >
              제보 취소
            </button>
          </div>

          <span className="block h-0.5 bg-border">
            <span
              className="block h-full bg-primary transition-[width] duration-300"
              style={{ width: `${((index + 1) / drafts.length) * 100}%` }}
            />
          </span>
        </div>

        {previewUrl && (
          <div className="shrink-0 border-b border-border bg-sub px-4 py-3">
            <ImageZoom
              src={previewUrl}
              alt={`${index + 1}번째 이벤트를 읽어낸 이미지`}
              className="mx-auto max-h-40 w-auto rounded object-contain"
            />
            <p className="pt-2 text-center text-xs text-text-muted">
              탭하면 크게 볼 수 있어요
            </p>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {event.confirmReasons.length > 0 && (
            <ul className="flex flex-col gap-0.5 rounded-lg bg-point/20 p-2">
              {event.confirmReasons.map((reason) => (
                <li key={reason} className="text-xs text-text">
                  {EVENT_CONFIRM_MESSAGE[reason]}
                </li>
              ))}
            </ul>
          )}

          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={include}
              onChange={({ target }) => update({ include: target.checked })}
            />
            이 이벤트를 저장할게요
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">이벤트 이름</span>
            <Input
              value={event.title}
              disabled={!include}
              onChange={({ target }) => updateEvent({ title: target.value })}
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">기간</span>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={event.periodStart}
                disabled={!include}
                aria-label="시작일"
                onChange={({ target }) =>
                  updateEvent({ periodStart: target.value })
                }
              />
              <span className="text-xs text-text-muted">~</span>
              <Input
                type="date"
                value={event.periodEnd}
                disabled={!include}
                aria-label="종료일"
                onChange={({ target }) =>
                  updateEvent({ periodEnd: target.value })
                }
              />
            </div>
          </div>

          {invalidPeriod && (
            <p className="text-xs text-destructive">
              시작일이 종료일보다 늦어요.
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">적용 회차</span>
            <select
              value={event.session ?? ""}
              disabled={!include}
              className="h-9 rounded-lg border border-input bg-transparent px-2 text-xs text-text disabled:opacity-50"
              onChange={({ target }) =>
                updateEvent({
                  session: EVENT_SESSION.isCode(target.value)
                    ? target.value
                    : undefined,
                })
              }
            >
              <option value="">그날 모든 회차</option>
              {EVENT_SESSION.options.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}만
                </option>
              ))}
            </select>
          </label>

          {event.overlapping.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                이미 등록된 이벤트와의 관계
              </span>
              <select
                value={replacesGroupId ?? ""}
                disabled={!include}
                className="h-9 rounded-lg border border-input bg-transparent px-2 text-xs text-text disabled:opacity-50"
                onChange={({ target }) =>
                  update({
                    replacesGroupId: target.value
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
            </label>
          )}

          {include && periodChanges && (
            <p className="rounded-lg bg-point/20 p-2 text-xs text-text">
              저장하면 이미 등록된 {replacing.periodStart} ~{" "}
              {replacing.periodEnd} 대신 {event.periodStart} ~ {event.periodEnd}
              가 보여요.
            </p>
          )}

          {event.description && (
            <p className="text-xs text-text-muted">{event.description}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4">
          <p className="text-xs text-text-muted">
            AI가 이미지에서 읽어낸 값이라 틀릴 수 있어요. 저장하면 다른 사람에게
            그대로 보여요.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              disabled={index === 0 || saving}
              className="rounded-4xl border border-border px-4 py-2 text-xs text-text disabled:opacity-40"
            >
              이전
            </button>

            <button
              type="button"
              onClick={() => (isLast ? onConfirm() : setIndex(index + 1))}
              disabled={saving}
              className="flex-1 rounded-4xl bg-point px-4 py-2 text-xs font-bold text-text disabled:opacity-60"
            >
              {saving ? "저장하는 중…" : isLast ? "이대로 저장하기" : "다음"}
            </button>
          </div>

          {!isLast && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving}
              className="text-xs text-text-muted underline underline-offset-2 disabled:opacity-50"
            >
              남은 {drafts.length - index - 1}건은 확인하지 않고 저장하기
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
};
