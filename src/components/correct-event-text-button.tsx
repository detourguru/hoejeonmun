"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { correctEventText } from "@/app/(main)/show/[id]/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { Input } from "@/components/ui/input";

export const CorrectEventTextButton = ({
  showId,
  eventId,
  initialTitle,
  initialDescription,
}: {
  showId: string;
  eventId: number;
  initialTitle: string;
  initialDescription: string | null;
}) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openSheet = () => {
    setTitle(initialTitle);
    setDescription(initialDescription ?? "");
    setError(null);
    setOpen(true);
  };

  const handleSubmit = () => {
    setError(null);

    startTransition(async () => {
      const result = await correctEventText(
        showId,
        eventId,
        title,
        description,
      );

      if (!result.ok) {
        if (result.message === "로그인이 필요해요.") {
          router.push(
            `/login?next=${encodeURIComponent(`/show/${showId}`)}`,
          );
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
            제목과 설명을 바로 고칠 수 있어요. 신고가 쌓이면 다른 정보와
            같은 기준으로 내려가요.
          </p>

          <Input
            value={title}
            onChange={({ target }) => setTitle(target.value)}
            placeholder="이벤트 제목"
            aria-label="제목"
          />

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
              disabled={pending}
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
