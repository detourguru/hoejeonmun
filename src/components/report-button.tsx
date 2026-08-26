"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  cancelEventReport,
  cancelReport,
  EventReportType,
  reportEvent,
  reportSlot,
  SlotReportType,
} from "@/app/(main)/show/[id]/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { cn } from "@/lib/utils";

type ReportTarget =
  | { kind: "slot"; showId: string; uploadId: number; slotId: number }
  | { kind: "event"; showId: string; eventId: number };

const SLOT_REASONS: { value: SlotReportType; label: string }[] = [
  { value: "wrong_date", label: "잘못된 날짜" },
  { value: "wrong_cast", label: "잘못된 캐스트" },
  { value: "wrong_show", label: "다른 공연 정보" },
  { value: "other", label: "기타" },
];

const EVENT_REASONS: { value: EventReportType; label: string }[] = [
  { value: "wrong_event", label: "잘못된 이벤트 정보" },
  { value: "other", label: "기타" },
];

export const ReportButton = ({
  target,
  reported: initial,
  label,
}: {
  target: ReportTarget;
  reported: boolean;
  label: string;
}) => {
  const router = useRouter();

  const [reported, setReported] = useState(initial);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<SlotReportType | EventReportType>(
    "other",
  );
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reasons = target.kind === "slot" ? SLOT_REASONS : EVENT_REASONS;

  const openSheet = () => {
    setReason(target.kind === "slot" ? "wrong_cast" : "wrong_event");
    setContext("");
    setError(null);
    setOpen(true);
  };

  const handleCancel = () => {
    // 낙관적 update
    setReported(false);

    startTransition(async () => {
      const result =
        target.kind === "slot"
          ? await cancelReport(target.showId, target.uploadId, target.slotId)
          : await cancelEventReport(target.showId, target.eventId);

      if (!result.ok) {
        setReported(true);

        if (result.message === "로그인이 필요해요.") {
          router.push(
            `/login?next=${encodeURIComponent(`/show/${target.showId}`)}`,
          );
          return;
        }

        toast.error(result.message);
        return;
      }

      toast.success("신고를 취소했어요.");
    });
  };

  const handleSubmit = () => {
    setError(null);

    startTransition(async () => {
      const result =
        target.kind === "slot"
          ? await reportSlot(
              target.showId,
              target.uploadId,
              target.slotId,
              reason as SlotReportType,
              context,
            )
          : await reportEvent(
              target.showId,
              target.eventId,
              reason as EventReportType,
              context,
            );

      if (!result.ok) {
        if (result.message === "로그인이 필요해요.") {
          router.push(
            `/login?next=${encodeURIComponent(`/show/${target.showId}`)}`,
          );
          return;
        }

        setError(result.message);
        return;
      }

      setReported(true);
      setOpen(false);

      if (result.hidden) {
        toast.success("신고가 누적되어 목록에서 자동으로 내려갔어요.");
      } else {
        toast.success("신고가 접수됐어요.");
      }
    });
  };

  if (reported) {
    return (
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="text-destructive inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] underline underline-offset-2 disabled:opacity-60"
      >
        신고취소
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="text-text-muted hover:text-destructive inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] transition-colors"
      >
        신고
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title={`${label} 신고`}>
        <div className="flex flex-col gap-4">
          <p className="text-text-muted text-center text-xs">
            잘못된 {target.kind === "slot" ? "회차" : "이벤트"} 정보를 신고하고
            있어요. 어떤 문제인지 알려주세요.
          </p>

          <div className="flex flex-col gap-1.5">
            {reasons.map(({ value, label: reasonLabel }) => (
              <button
                key={value}
                type="button"
                onClick={() => setReason(value)}
                className={cn(
                  "border-border rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  reason === value
                    ? "border-primary bg-primary text-white"
                    : "text-text",
                )}
              >
                {reasonLabel}
              </button>
            ))}
          </div>

          {reason === "other" && (
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              placeholder="어떤 부분이 잘못됐는지 알려주세요"
              rows={3}
              className="border-border bg-surface text-text placeholder:text-text-muted w-full rounded-lg border p-2 text-left text-xs"
            />
          )}

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="border-border text-text hover:bg-point inline-flex rounded-4xl border px-3 py-1 text-xs transition-colors disabled:opacity-60"
            >
              신고하기
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
