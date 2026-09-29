"use client";

import { Share2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { createCalendarShareLink } from "@/app/(main)/mypage/actions";
import { useLoginRedirect } from "@/hook/useLoginRedirect";
import { buildShareCalendarUrl } from "@/lib/share-url";

export const ShareCalendarButton = () => {
  const searchParams = useSearchParams();
  const loginRedirect = useLoginRedirect("/mypage/shows");
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createCalendarShareLink();

      if (!result.ok) {
        loginRedirect(result.message);
        return;
      }

      const url = buildShareCalendarUrl(
        location.origin,
        result.token,
        searchParams,
      );

      await navigator.clipboard.writeText(url);
      toast.success("공유 링크를 복사했어요.");
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="border-border text-text-muted hover:text-text inline-flex items-center gap-1 rounded-4xl border px-3 py-1 text-xs transition-colors disabled:opacity-60"
    >
      <Share2 className="size-3.5" />
      공유
    </button>
  );
};
