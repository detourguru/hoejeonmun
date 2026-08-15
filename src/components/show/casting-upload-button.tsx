"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  MAX_IMAGE_BYTES,
} from "@/type/casting";

type Status = "idle" | "uploading" | "analyzing" | "saving" | "done";

const STATUS_LABEL: Record<Status, string> = {
  idle: "캐스팅보드 제보하기",
  uploading: "이미지 올리는 중…",
  analyzing: "표 읽는 중…",
  saving: "저장하는 중…",
  done: "추가 제보하기",
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CastingUploadButton = ({ showId }: { showId: string }) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CastingBoardResult | null>(null);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleClick = async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (!userId) {
      router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
      return;
    }

    inputRef.current?.click();
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    event.target.value = "";

    if (files.length === 0) return;

    previewUrls.forEach((url) => URL.revokeObjectURL(url));

    setPreviewUrls(files.map((file) => URL.createObjectURL(file)));
    setResult(null);
    setError(null);

    if (files.some((file) => file.size > MAX_IMAGE_BYTES)) {
      setError("이미지 1장당 10MB 이하만 올릴 수 있어요.");
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

    const storagePaths: string[] = [];

    for (const file of files) {
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

      storagePaths.push(storagePath);
    }

    setStatus("analyzing");

    const parseResponse = await fetch("/api/casting-boards/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ showId, storagePaths }),
    });

    if (!parseResponse.ok) {
      const { message } = await parseResponse
        .json()
        .catch(() => ({ message: "분석에 실패했어요." }));

      setStatus("idle");
      setError(message);
      return;
    }

    const { performances, skippedCount } = await parseResponse.json();

    setStatus("saving");

    const saveResponse = await fetch("/api/casting-boards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        showId,
        storagePaths,
        performances,
        skippedCount,
      }),
    });

    if (!saveResponse.ok) {
      const { message } = await saveResponse
        .json()
        .catch(() => ({ message: "저장에 실패했어요." }));

      setStatus("idle");
      setError(message);
      return;
    }

    setResult(await saveResponse.json());
    setStatus("done");

    // 저장된 회차가 캐스팅보드 영역에 바로 보이도록
    router.refresh();
  };

  const pending =
    status === "uploading" || status === "analyzing" || status === "saving";

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex w-fit rounded-4xl border border-border px-3 py-1 text-xs text-text transition-colors hover:bg-point disabled:opacity-60"
      >
        {STATUS_LABEL[status]}
      </button>

      {status === "idle" && !error && !result && (
        <ul className="list-inside list-disc text-xs text-text-muted">
          <li>또렷한 사진일수록 좋아요</li>
          <li>이름, 배역이 잘 보이게 찍어주세요</li>
          <li>캡처보다 원본 이미지가 더 빨리 읽혀요</li>
        </ul>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <p className="text-xs text-text-muted">
          회차 {result.slotCount}개, 배우 {result.actorCount}명을 저장했어요.
          {result.skippedCount > 0 &&
            ` (읽지 못한 행 ${result.skippedCount}개는 건너뛰었어요.)`}
        </p>
      )}

      {previewUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previewUrls.map((url) => (
            // blob: URL은 최적화 대상이 아니고 업로드 후 휘발되므로 next/image를 쓰지 않는다
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt="선택한 캐스팅보드 미리보기"
              className="h-auto w-full max-w-40 rounded"
            />
          ))}
        </div>
      )}
    </div>
  );
};
