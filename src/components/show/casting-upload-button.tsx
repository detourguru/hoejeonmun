"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ImageZoom } from "@/components/image-zoom";
import {
  EventConfirmSheet,
  EventDraft,
  toConfirmedEvents,
  toEventDrafts,
} from "@/components/show/event-confirm-sheet";
import { UploadProgress } from "@/components/show/upload-progress";
import { createClient } from "@/lib/supabase/client";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  ConfirmedEvent,
  MAX_IMAGE_BYTES,
  ParsedPerformance,
  PendingEvent,
  UploadStatus,
} from "@/type/casting";

const STATUS_LABEL: Record<UploadStatus, string> = {
  idle: "캐스팅보드/이벤트 제보하기",
  selecting: "이미지 고르는 중…",
  uploading: "이미지 올리는 중…",
  analyzing: "표 읽는 중…",
  confirming: "이벤트 확인 중…",
  saving: "저장하는 중…",
  done: "추가 제보하기",
};

type ParsedUpload = {
  storagePaths: string[];
  performances: ParsedPerformance[];
  skippedCount: number;
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CastingUploadButton = ({
  showId,
  isLoggedIn,
}: {
  showId: string;
  isLoggedIn: boolean;
}) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CastingBoardResult | null>(null);
  const [parsed, setParsed] = useState<ParsedUpload | null>(null);
  const [drafts, setDrafts] = useState<EventDraft[]>([]);

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(
    () => () => previewUrlsRef.current.forEach(URL.revokeObjectURL),
    [],
  );

  const reset = () => {
    previewUrls.forEach(URL.revokeObjectURL);
    setFiles([]);
    setPreviewUrls([]);
    setUploadedCount(0);
    setParsed(null);
    setDrafts([]);
    setStatus("idle");
  };

  const handleClick = () => {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
      return;
    }

    if (status === "done") {
      reset();
      setResult(null);
    }

    inputRef.current?.click();
  };

  const handleChange = (change: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(change.target.files ?? []);

    change.target.value = "";

    if (picked.length === 0) return;

    const accepted = picked.filter(({ size }) => size <= MAX_IMAGE_BYTES);

    setError(
      accepted.length < picked.length
        ? "10MB가 넘는 이미지는 빼고 담았어요."
        : null,
    );
    setResult(null);
    setFiles([...files, ...accepted]);
    setPreviewUrls([...previewUrls, ...accepted.map(URL.createObjectURL)]);
    setStatus("selecting");
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles(files.filter((_, at) => at !== index));
    setPreviewUrls(previewUrls.filter((_, at) => at !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (!userId) {
      router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
      return;
    }

    setError(null);
    setUploadedCount(0);
    setStatus("uploading");

    const storagePaths: string[] = [];

    for (const file of files) {
      const extension = EXTENSIONS[file.type] ?? "jpg";
      const storagePath = `${userId}/${showId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(CASTING_BOARD_BUCKET)
        .upload(storagePath, file, { contentType: file.type });

      if (uploadError) {
        setStatus("selecting");
        setError("이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      storagePaths.push(storagePath);
      setUploadedCount(storagePaths.length);
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

      setStatus("selecting");
      setError(message);
      return;
    }

    const { performances, events, skippedCount } =
      (await parseResponse.json()) as {
        performances: ParsedPerformance[];
        events: PendingEvent[];
        skippedCount: number;
      };

    const upload = { storagePaths, performances, skippedCount };

    if (events.length > 0) {
      setParsed(upload);
      setDrafts(toEventDrafts(events));
      setStatus("confirming");
      return;
    }

    await save(upload, []);
  };

  const save = async (upload: ParsedUpload, events: ConfirmedEvent[]) => {
    setStatus("saving");

    const saveResponse = await fetch("/api/casting-boards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ showId, ...upload, events }),
    });

    if (!saveResponse.ok) {
      const { message } = await saveResponse
        .json()
        .catch(() => ({ message: "저장에 실패했어요." }));

      setStatus(parsed ? "confirming" : "selecting");
      setError(message);
      return;
    }

    setResult(await saveResponse.json());
    setParsed(null);
    setDrafts([]);
    setStatus("done");

    // 저장된 회차가 캐스팅보드 영역에 바로 보이도록
    router.refresh();
  };

  const handleConfirm = async () => {
    if (!parsed) return;

    const events = toConfirmedEvents(drafts);

    if (events.some(({ periodStart, periodEnd }) => periodStart > periodEnd)) {
      setError("시작일이 종료일보다 늦은 이벤트가 있어요.");
      return;
    }

    if (parsed.performances.length === 0 && events.length === 0) {
      reset();
      return;
    }

    setError(null);

    await save(parsed, events);
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

      {status !== "selecting" && (
        <button
          type="button"
          onClick={handleClick}
          disabled={pending || status === "confirming"}
          className="inline-flex w-fit rounded-4xl border border-border px-3 py-1 text-xs text-text transition-colors hover:bg-point disabled:opacity-60"
        >
          {STATUS_LABEL[status]}
        </button>
      )}

      <UploadProgress
        status={status}
        uploadedCount={uploadedCount}
        totalCount={files.length}
      />

      {status === "selecting" && (
        <div className="flex flex-col gap-3 rounded-lg bg-point/10 p-3">
          <p className="text-xs text-text">빼고 싶은 이미지가 있으면 지워주세요.</p>

          <ul className="flex flex-wrap gap-2">
            {previewUrls.map((url, index) => (
              <li key={url} className="flex w-24 flex-col gap-1">
                <ImageZoom
                  src={url}
                  alt={`${index + 1}번째로 고른 이미지`}
                  className="h-24 w-24 rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-xs text-text-muted underline underline-offset-2"
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={files.length === 0}
              className="inline-flex rounded-4xl border border-border bg-point px-3 py-1 text-xs font-bold text-text disabled:opacity-40"
            >
              {files.length}장 올리기
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex rounded-4xl border border-border px-3 py-1 text-xs text-text"
            >
              더 고르기
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex rounded-4xl px-3 py-1 text-xs text-text-muted underline underline-offset-2"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <EventConfirmSheet
        open={status === "confirming" || (status === "saving" && !!parsed)}
        drafts={drafts}
        previewUrls={previewUrls}
        saving={status === "saving"}
        onChange={setDrafts}
        onConfirm={handleConfirm}
        onCancel={reset}
      />

      {status === "idle" && !error && !result && (
        <ul className="list-inside list-disc text-xs text-text-muted">
          <li>또렷한 사진일수록 좋아요</li>
          <li>이름, 배역이나 이벤트 내용과 날짜가 잘 보이게 찍어주세요</li>
          <li>캡처보다 원본 이미지가 더 빨리 읽혀요</li>
        </ul>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <p className="text-xs text-text-muted">
          {result.slotCount > 0 &&
            `회차 ${result.slotCount}개, 배우 ${result.actorCount}명`}
          {result.slotCount > 0 && result.eventCount > 0 && ", "}
          {result.eventCount > 0 && `이벤트 ${result.eventCount}건`}을
          저장했어요.
          {result.skippedCount > 0 &&
            ` (읽지 못한 행 ${result.skippedCount}개는 건너뛰었어요.)`}
        </p>
      )}
    </div>
  );
};
