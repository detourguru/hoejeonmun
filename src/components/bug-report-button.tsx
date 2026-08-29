"use client";

import { MessageSquareWarning } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitBugReport } from "@/app/(main)/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { ImageZoom } from "@/components/image-zoom";
import { createClient } from "@/lib/supabase/client";
import {
  BUG_REPORT_IMAGE_BUCKET,
  MAX_BUG_REPORT_IMAGE_BYTES,
  MAX_BUG_REPORT_IMAGE_COUNT,
} from "@/type/bug-report";

const DRAFT_KEY = "bugReportDraft";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const BugReportButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
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

  const resetFiles = () => {
    previewUrls.forEach(URL.revokeObjectURL);
    setFiles([]);
    setPreviewUrls([]);
  };

  const openSheet = () => {
    setMessage("");
    setError(null);
    resetFiles();
    setOpen(true);
  };

  const addFiles = (newFiles: File[]) => {
    const valid: File[] = [];
    const tooLarge: string[] = [];

    for (const file of newFiles) {
      if (file.size > MAX_BUG_REPORT_IMAGE_BYTES) tooLarge.push(file.name);
      else valid.push(file);
    }

    const room = Math.max(0, MAX_BUG_REPORT_IMAGE_COUNT - files.length);
    const accepted = valid.slice(0, room);
    const overflowCount = valid.length - accepted.length;
    const messages: string[] = [];

    if (tooLarge.length > 0) {
      messages.push(`${tooLarge.join(", ")} 파일이 10MB를 초과해 제외됐어요.`);
    }

    if (overflowCount > 0) {
      messages.push(
        `사진은 최대 ${MAX_BUG_REPORT_IMAGE_COUNT}장까지 첨부할 수 있어요.`,
      );
    }

    setError(messages.length > 0 ? messages.join(" ") : null);

    if (accepted.length === 0) return;

    setFiles((current) => [...current, ...accepted]);
    setPreviewUrls((current) => [
      ...current,
      ...accepted.map(URL.createObjectURL),
    ]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (picked.length > 0) addFiles(picked);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles((current) => current.filter((_, at) => at !== index));
    setPreviewUrls((current) => current.filter((_, at) => at !== index));
  };

  const handleSubmit = () => {
    setError(null);

    startTransition(async () => {
      const query = searchParams.toString();
      const url = query ? `${pathname}?${query}` : pathname;

      const imagePaths: string[] = [];

      if (files.length > 0) {
        const supabase = createClient();
        const { data } = await supabase.auth.getClaims();
        const userId = data?.claims?.sub;

        if (!userId) {
          sessionStorage.setItem(DRAFT_KEY, message);
          router.push(`/login?next=${encodeURIComponent(url)}`);
          return;
        }

        for (const file of files) {
          const extension = EXTENSIONS[file.type] ?? "jpg";
          const storagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from(BUG_REPORT_IMAGE_BUCKET)
            .upload(storagePath, file, { contentType: file.type });

          if (uploadError) {
            setError("사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
            return;
          }

          imagePaths.push(storagePath);
        }
      }

      const result = await submitBugReport(
        message,
        url,
        navigator.userAgent,
        imagePaths,
      );

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
      resetFiles();
      toast.success("요청이 전달되었어요. 최대한 빠르게 확인해볼게요.");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label="문의하기"
        className="bg-primary fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 inline-flex size-12 items-center justify-center rounded-full text-white shadow-lg shadow-black/15 transition-all hover:opacity-90 hover:shadow-xl active:scale-95"
      >
        <MessageSquareWarning className="size-5" />
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title="문의 · 버그신고">
        <div className="flex flex-col gap-4">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="무엇이든 문의하세요"
            rows={4}
            className="border-border bg-surface text-text placeholder:text-text-muted w-full rounded-lg border p-2 text-left text-xs"
          />

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrls.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2">
              {previewUrls.map((url, index) => (
                <li key={url} className="flex w-16 flex-col gap-1">
                  <ImageZoom
                    src={url}
                    alt={`첨부한 ${index + 1}번째 사진`}
                    className="h-16 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-text-muted text-[11px] underline underline-offset-2"
                  >
                    빼기
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={files.length >= MAX_BUG_REPORT_IMAGE_COUNT}
            className="border-border text-text-muted mx-auto inline-flex rounded-4xl border px-3 py-1 text-xs disabled:opacity-40"
          >
            사진 추가 ({files.length}/{MAX_BUG_REPORT_IMAGE_COUNT})
          </button>

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
