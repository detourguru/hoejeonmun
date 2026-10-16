"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { revertCastingEdit } from "@/app/(main)/show/[id]/actions";

export const RevertEditButton = ({
  showId,
  editId,
}: {
  showId: string;
  editId: number;
}) => {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleRevert = () => {
    setError(null);

    startTransition(async () => {
      const result = await revertCastingEdit(showId, editId);

      setConfirming(false);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      toast.success("되돌렸어요.");
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {confirming ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="border-border text-text-muted rounded-lg border px-2 py-1 text-xs disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleRevert}
            disabled={pending}
            className="bg-point text-text rounded-lg px-2 py-1 text-xs font-bold disabled:opacity-50"
          >
            {pending ? "되돌리는 중…" : "되돌리기 확인"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="border-border text-text rounded-lg border px-2 py-1 text-xs"
        >
          되돌리기
        </button>
      )}

      {error && (
        <p className="text-destructive max-w-40 text-right text-[11px]">
          {error}
        </p>
      )}
    </div>
  );
};
