"use client";

import { ImageZoom } from "@/components/image-zoom";
import { EventDraft } from "@/components/show/event-confirm-list";
import { SlotChecklist } from "@/components/show/slot-checklist";
import { SlotExceptionEditor } from "@/components/show/slot-exception-editor";
import { Input } from "@/components/ui/input";
import { toShortDate } from "@/lib/date";
import { datesWithoutSchedule, slotsWithinPeriod } from "@/lib/event-period";
import { EVENT_CONFIRM_MESSAGE } from "@/type/casting";

export const EventReview = ({
  draft,
  index,
  count,
  knownDates,
  knownSlots,
  previewUrl,
  onDraftChange,
  onEventChange,
}: {
  draft: EventDraft;
  index: number;
  count: number;
  knownDates: Set<string>;
  knownSlots: { date: string; time: string }[];
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
  const slotsInPeriod = slotsWithinPeriod(
    event.periodStart,
    event.periodEnd,
    knownSlots,
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
            knownSlots={knownSlots}
            disabled={!include}
            onChange={(items) => onEventChange({ includedSlots: items })}
          />

          <SlotChecklist
            slots={slotsInPeriod}
            excludedSlots={event.excludedSlots ?? []}
            exactTimes={event.exactTimes}
            listedSlots={event.listedSlots}
            periodStart={event.periodStart}
            periodEnd={event.periodEnd}
            periodStartCutoffTime={event.periodStartCutoffTime}
            periodEndCutoffTime={event.periodEndCutoffTime}
            disabled={!include}
            onChange={(excludedSlots) =>
              onEventChange({
                excludedSlots:
                  excludedSlots.length > 0 ? excludedSlots : undefined,
                exactTimes: undefined,
                listedSlots: undefined,
                periodStartCutoffTime: undefined,
                periodEndCutoffTime: undefined,
              })
            }
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
            className="border-input text-text rounded-control h-10 border bg-transparent px-2 text-base disabled:opacity-50 md:text-sm"
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
        <div className="bg-muted-foreground/20 rounded-xl p-4">
          <p className="text-text text-xs whitespace-pre-line">
            {event.description}
          </p>
        </div>
      )}
    </div>
  );
};
