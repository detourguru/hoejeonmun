"use client";

import { LifeBuoy } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitBugReport } from "@/app/(main)/actions";
import { BottomSheet } from "@/components/bottom-sheet";

const DRAFT_KEY = "bugReportDraft";

export const BugReportButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);

    if (!draft) return;

    sessionStorage.removeItem(DRAFT_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage(draft);
    setOpen(true);
  }, []);

  if (pathname === "/login") return null;

  const openSheet = () => {
    setMessage("");
    setError(null);
    setOpen(true);
  };

  const handleSubmit = () => {
    setError(null);

    startTransition(async () => {
      const query = searchParams.toString();
      const url = query ? `${pathname}?${query}` : pathname;

      const result = await submitBugReport(message, url, navigator.userAgent);

      if (!result.ok) {
        if (result.message === "로그인이 필요해요.") {
          sessionStorage.setItem(DRAFT_KEY, message);
          router.push(`/login?next=${encodeURIComponent(url)}`);
          return;
        }

        setError(result.message);
        return;
      }

      setOpen(false);
      setMessage("");
      toast.success("요청이 전달되었어요. 최대한 빠르게 확인해볼게요.");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="bg-primary fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-white shadow-lg"
      >
        <LifeBuoy className="size-4" />
        문의
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title="문의 · 버그신고">
        <div className="flex flex-col gap-4">
          <p className="text-text-muted text-center text-xs">
            화면이 이상하거나 궁금한 점을 알려주세요. 새로운 기능에 대한 요청도
            환영입니다.
          </p>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="어떤 문제가 있었는지 알려주세요"
            rows={4}
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
              보내기
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
