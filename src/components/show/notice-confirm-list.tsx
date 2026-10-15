"use client";

import { toShortDate } from "@/lib/date";
import {
  CastingNotices,
  ExcludedNotices,
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
} from "@/type/casting";

type NoticeKind = keyof CastingNotices;

export type NoticeDraft = { index: number; include: boolean } & (
  | { kind: "cancelledSlots"; item: ParsedCancelledSlot }
  | { kind: "castingChanges"; item: ParsedCastingChange }
  | { kind: "cancelledEvents"; item: ParsedCancelledEvent }
);

const NOTICE_LABEL: Record<NoticeKind, string> = {
  cancelledSlots: "회차 취소",
  castingChanges: "캐스팅 변경",
  cancelledEvents: "이벤트 취소",
};

export const toNoticeDrafts = (notices: CastingNotices): NoticeDraft[] => [
  ...notices.cancelledSlots.map((item, index) => ({
    kind: "cancelledSlots" as const,
    index,
    item,
    include: true,
  })),
  ...notices.castingChanges.map((item, index) => ({
    kind: "castingChanges" as const,
    index,
    item,
    include: true,
  })),
  ...notices.cancelledEvents.map((item, index) => ({
    kind: "cancelledEvents" as const,
    index,
    item,
    include: true,
  })),
];

export const toggleNotice = (
  drafts: NoticeDraft[],
  kind: NoticeKind,
  index: number,
): NoticeDraft[] =>
  drafts.map((draft) =>
    draft.kind === kind && draft.index === index
      ? { ...draft, include: !draft.include }
      : draft,
  );

export const toExcludedNotices = (drafts: NoticeDraft[]): ExcludedNotices => {
  const excluded = (kind: NoticeKind) =>
    drafts
      .filter((draft) => draft.kind === kind && !draft.include)
      .map(({ index }) => index);

  return {
    cancelledSlots: excluded("cancelledSlots"),
    castingChanges: excluded("castingChanges"),
    cancelledEvents: excluded("cancelledEvents"),
  };
};

export const countIncludedNotices = (drafts: NoticeDraft[]) =>
  drafts.filter(({ include }) => include).length;

const describeNotice = (draft: NoticeDraft) => {
  switch (draft.kind) {
    case "cancelledSlots":
      return `${toShortDate(draft.item.date)} ${draft.item.time}`;
    case "castingChanges":
      return `${toShortDate(draft.item.date)} ${draft.item.time} ${draft.item.role} → ${draft.item.actor}`;
    case "cancelledEvents":
      return `${draft.item.title} ${toShortDate(draft.item.periodStart)}~${toShortDate(draft.item.periodEnd)}`;
  }
};

export const NoticeConfirmList = ({
  drafts,
  disabled,
  onChange,
}: {
  drafts: NoticeDraft[];
  disabled: boolean;
  onChange: (drafts: NoticeDraft[]) => void;
}) => (
  <section className="flex flex-col gap-2">
    <p className="text-text-muted text-xs">
      공지에서 읽어낸 취소·변경이에요. 저장하면 바로 반영되니 잘못 읽은 항목은
      체크를 풀어 주세요.
    </p>

    <ul className="flex flex-col gap-1">
      {drafts.map((draft) => (
        <li key={`${draft.kind}-${draft.index}`}>
          <label className="text-text flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.include}
              disabled={disabled}
              onChange={() =>
                onChange(toggleNotice(drafts, draft.kind, draft.index))
              }
            />
            <span className="border-border text-text-muted shrink-0 rounded border px-1 text-[10px]">
              {NOTICE_LABEL[draft.kind]}
            </span>
            {describeNotice(draft)}
          </label>
        </li>
      ))}
    </ul>
  </section>
);
