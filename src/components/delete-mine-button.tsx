"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteMyEvent,
  deleteMySlotCasting,
  deleteMyUpload,
} from "@/app/(main)/show/[id]/actions";
import { BottomSheet } from "@/components/bottom-sheet";

type DeleteTarget =
  | { kind: "slot"; showId: string; uploadId: number; slotId: number }
  | { kind: "event"; showId: string; eventId: number }
  | { kind: "upload"; showId: string; uploadId: number };

const TARGET_LABEL: Record<DeleteTarget["kind"], string> = {
  slot: "회차",
  event: "이벤트",
  upload: "캐스팅보드",
};

export const DeleteMineButton = ({
  target,
  label,
}: {
  target: DeleteTarget;
  label: string;
}) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);

    startTransition(async () => {
      const result =
        target.kind === "slot"
          ? await deleteMySlotCasting(
              target.showId,
              target.uploadId,
              target.slotId,
            )
          : target.kind === "event"
            ? await deleteMyEvent(target.showId, target.eventId)
            : await deleteMyUpload(target.showId, target.uploadId);

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

      setOpen(false);
      toast.success(`내가 올린 ${TARGET_LABEL[target.kind]}를 지웠어요.`);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label} 삭제`}
        className="text-text-muted hover:text-destructive inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] transition-colors"
      >
        ×
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title={`${label} 삭제`}>
        <div className="flex flex-col gap-4">
          <p className="text-text-muted text-center text-xs">
            내가 올린 {TARGET_LABEL[target.kind]} 정보를 지워요. 되돌릴 수
            없어요.
          </p>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="border-border text-destructive hover:bg-destructive/10 inline-flex rounded-4xl border px-3 py-1 text-xs transition-colors disabled:opacity-60"
            >
              삭제하기
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
