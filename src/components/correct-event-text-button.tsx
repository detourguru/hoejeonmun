"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  correctEventText,
  getEventSlotAdjustments,
} from "@/app/(main)/show/[id]/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { SlotExceptionEditor } from "@/components/show/slot-exception-editor";
import { Input } from "@/components/ui/input";
import { EventSlotException } from "@/type/casting";

export const CorrectEventTextButton = ({
  showId,
  eventId,
  initialTitle,
  initialDescription,
  initialPeriodStart,
  initialPeriodEnd,
}: {
  showId: string;
  eventId: number;
  initialTitle: string;
  initialDescription: string | null;
  initialPeriodStart: string;
  initialPeriodEnd: string;
}) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [periodStart, setPeriodStart] = useState(initialPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(initialPeriodEnd);
  const [includedSlots, setIncludedSlots] = useState<EventSlotException[]>([]);
  const [excludedSlots, setExcludedSlots] = useState<EventSlotException[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openSheet = () => {
    setTitle(initialTitle);
    setDescription(initialDescription ?? "");
    setPeriodStart(initialPeriodStart);
    setPeriodEnd(initialPeriodEnd);
    setIncludedSlots([]);
    setExcludedSlots([]);
    setError(null);
    setOpen(true);

    setLoadingSlots(true);
    getEventSlotAdjustments(
      showId,
      eventId,
      initialPeriodStart,
      initialPeriodEnd,
    )
      .then(({ included, excluded }) => {
        setIncludedSlots(included);
        setExcludedSlots(excluded);
      })
      .catch(() => {
        setError("적용 회차를 불러오지 못했어요. 다시 열어 주세요.");
      })
      .finally(() => setLoadingSlots(false));
  };

  const handleSubmit = () => {
    if (periodStart > periodEnd) {
      setError("시작일이 종료일보다 늦어요.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await correctEventText(
        showId,
        eventId,
        title,
        description,
        periodStart,
        periodEnd,
        includedSlots,
        excludedSlots,
      );

      if (!result.ok) {
        if (result.message === "로그인이 필요해요.") {
          router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
          return;
        }

        setError(result.message);
        return;
      }

      setOpen(false);
      toast.success("정정 제안이 반영됐어요.");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="text-text-muted hover:text-primary inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] transition-colors"
      >
        정정 제안
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title="이벤트 정정 제안">
        <div className="flex flex-col gap-4">
          <p className="text-text-muted text-center text-xs">
            제목, 기간, 적용 회차, 설명을 바로 고칠 수 있어요. 신고가 쌓이면
            다른 정보와 같은 기준으로 내려가요.
          </p>

          <Input
            value={title}
            onChange={({ target }) => setTitle(target.value)}
            placeholder="이벤트 제목"
            aria-label="제목"
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-text-muted text-[11px] font-bold">기간</span>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={periodStart}
                aria-label="시작일"
                onChange={({ target }) => setPeriodStart(target.value)}
              />
              <span className="text-text-muted text-xs">~</span>
              <Input
                type="date"
                value={periodEnd}
                aria-label="종료일"
                onChange={({ target }) => setPeriodEnd(target.value)}
              />
            </div>
          </div>

          {loadingSlots ? (
            <p className="text-text-muted text-xs">적용 회차를 불러오는 중…</p>
          ) : (
            <>
              <SlotExceptionEditor
                label="기간 막대 밖에서 추가로 포함되는 회차"
                items={includedSlots}
                disabled={false}
                onChange={setIncludedSlots}
              />

              <SlotExceptionEditor
                label="기간 안에서 제외되는 회차"
                items={excludedSlots}
                disabled={false}
                onChange={setExcludedSlots}
              />
            </>
          )}

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="이벤트 설명 (선택)"
            rows={3}
            className="border-border bg-surface text-text placeholder:text-text-muted w-full rounded-lg border p-2 text-left text-xs"
          />

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || loadingSlots}
              className="border-border text-text hover:bg-point inline-flex rounded-4xl border px-3 py-1 text-xs transition-colors disabled:opacity-60"
            >
              정정 제안하기
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-text-muted inline-flex rounded-4xl px-3 py-1 text-xs underline underline-offset-2"
            >
              취소
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
};
