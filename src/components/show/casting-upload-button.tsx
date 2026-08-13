"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  MAX_IMAGE_BYTES,
} from "@/type/casting";

type Status = "idle" | "uploading" | "analyzing" | "done";

const STATUS_LABEL: Record<Status, string> = {
  idle: "캐스팅보드 제보하기",
  uploading: "이미지 올리는 중…",
  analyzing: "표 읽는 중…",
  done: "다시 제보하기",
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CastingUploadButton = ({ showId }: { showId: string }) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CastingBoardResult | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);

    if (file.size > MAX_IMAGE_BYTES) {
      setError("10MB 이하 이미지만 올릴 수 있어요.");
      return;
    }

    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (!userId) {
      router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
      return;
    }

    setStatus("uploading");

    const extension = EXTENSIONS[file.type] ?? "jpg";
    const storagePath = `${userId}/${showId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(CASTING_BOARD_BUCKET)
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
      setStatus("idle");
      setError("이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setStatus("analyzing");

    const response = await fetch("/api/casting-boards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ showId, storagePath }),
    });

    if (!response.ok) {
      const { message } = await response
        .json()
        .catch(() => ({ message: "분석에 실패했어요." }));

      setStatus("idle");
      setError(message);
      return;
    }

    setResult(await response.json());
    setStatus("done");

    // 저장된 회차가 캐스팅보드 영역에 바로 보이도록
    router.refresh();
  };

  const pending = status === "uploading" || status === "analyzing";

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="inline-flex w-fit rounded-4xl border border-border px-3 py-1 text-xs text-text transition-colors hover:bg-point disabled:opacity-60"
      >
        {STATUS_LABEL[status]}
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <p className="text-xs text-text-muted">
          회차 {result.slotCount}개, 배우 {result.actorCount}명을 저장했어요.
          {result.skippedCount > 0 &&
            ` (읽지 못한 행 ${result.skippedCount}개는 건너뛰었어요.)`}
        </p>
      )}

      {previewUrl && (
        // blob: URL은 최적화 대상이 아니고 업로드 후 휘발되므로 next/image를 쓰지 않는다
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="선택한 캐스팅보드 미리보기"
          className="h-auto w-full max-w-xs rounded"
        />
      )}
    </div>
  );
};
