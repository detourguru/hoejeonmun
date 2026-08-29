"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { discardUploadImages } from "@/app/(main)/show/[id]/actions";
import { ImageZoom } from "@/components/image-zoom";
import {
  CastingDraft,
  toCastingDrafts,
  toConfirmedPerformances,
} from "@/components/show/casting-confirm-list";
import {
  EventDraft,
  toConfirmedEvents,
  toEventDrafts,
} from "@/components/show/event-confirm-list";
import { UploadConfirmSheet } from "@/components/show/upload-confirm-sheet";
import { UploadProgress } from "@/components/show/upload-progress";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  ConfirmedEvent,
  DEFAULT_REPORT_TYPE_TAB,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  ParsedPerformance,
  PendingEvent,
  PERFORMANCE_SKIP_MESSAGE,
  ReportTypeTab,
  SkippedPerformance,
  UploadStatus,
} from "@/type/casting";

type ParsedUpload = {
  storagePaths: string[];
  performances: ParsedPerformance[];
  skipped: SkippedPerformance[];
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const STATUS_LABEL: Record<UploadStatus, string> = {
  idle: "캐스팅보드/이벤트 제보하기",
  selecting: "이미지 고르는 중…",
  uploading: "이미지 올리는 중…",
  analyzing: "표 읽는 중…",
  confirming: "제보 확인 중…",
  saving: "저장하는 중…",
  done: "추가 제보하기",
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
  const [duplicateIndexes, setDuplicateIndexes] = useState<number[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CastingBoardResult | null>(null);
  const [parsed, setParsed] = useState<ParsedUpload | null>(null);
  const [drafts, setDrafts] = useState<EventDraft[]>([]);
  const [castingDrafts, setCastingDrafts] = useState<CastingDraft[]>([]);
  const [knownDates, setKnownDates] = useState<Set<string>>(new Set());
  const [showSkipped, setShowSkipped] = useState(false);
  const [reviewTab, setReviewTab] = useState<ReportTypeTab>(
    DEFAULT_REPORT_TYPE_TAB,
  );

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(
    () => () => previewUrlsRef.current.forEach(URL.revokeObjectURL),
    [],
  );

  const addFiles = (newFiles: File[]) => {
    const valid: File[] = [];
    const tooLarge: string[] = [];

    for (const file of newFiles) {
      if (file.size > MAX_IMAGE_BYTES) tooLarge.push(file.name);
      else valid.push(file);
    }

    const room = Math.max(0, MAX_IMAGE_COUNT - files.length);
    const accepted = valid.slice(0, room);
    const overflowCount = valid.length - accepted.length;
    const messages: string[] = [];

    if (tooLarge.length > 0) {
      messages.push(`${tooLarge.join(", ")} 파일이 10MB를 초과해 제외됐어요.`);
    }

    if (overflowCount > 0) {
      messages.push(
        `이미지는 최대 ${MAX_IMAGE_COUNT}장까지 올릴 수 있어요. ${overflowCount}장은 제외됐어요.`,
      );
    }

    setError(messages.length > 0 ? messages.join(" ") : null);
    setDuplicateIndexes([]);

    if (accepted.length === 0) return;

    setFiles((current) => [...current, ...accepted]);
    setPreviewUrls((current) => [
      ...current,
      ...accepted.map(URL.createObjectURL),
    ]);
    setStatus("selecting");
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles((current) => current.filter((_, at) => at !== index));
    setPreviewUrls((current) => current.filter((_, at) => at !== index));
    setDuplicateIndexes([]);
  };

  const reset = () => {
    previewUrls.forEach(URL.revokeObjectURL);
    setFiles([]);
    setPreviewUrls([]);
    setDuplicateIndexes([]);
    setUploadedCount(0);
    setResult(null);
    setError(null);
    setParsed(null);
    setDrafts([]);
    setCastingDrafts([]);
    setKnownDates(new Set());
    setShowSkipped(false);
    setStatus("idle");
  };

  const handleClick = () => {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
      return;
    }

    if (status === "done") reset();
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (picked.length > 0) addFiles(picked);
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
      const { message, duplicateIndexes: duplicates } = await parseResponse
        .json()
        .catch(() => ({ message: "분석에 실패했어요." }));

      setStatus("selecting");
      setError(message);
      setDuplicateIndexes(duplicates ?? []);
      void discardUploadImages(storagePaths);
      return;
    }

    const { performances, events, skipped } = (await parseResponse.json()) as {
      performances: ParsedPerformance[];
      events: PendingEvent[];
      skipped: SkippedPerformance[];
    };
    const upload = { storagePaths, performances, skipped };

    if (performances.length === 0 && events.length === 0) {
      await save(upload, []);
      return;
    }

    if (events.length > 0) {
      const dates = new Set(performances.map(({ date }) => date));
      const { data: existingSlots } = await supabase
        .from("slots")
        .select("date")
        .eq("show_id", showId);

      for (const { date } of existingSlots ?? []) dates.add(date);

      setKnownDates(dates);
    }

    setParsed(upload);
    setCastingDrafts(toCastingDrafts(performances));
    setDrafts(toEventDrafts(events));
    setReviewTab(performances.length > 0 ? "casting" : "event");
    setStatus("confirming");
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
    setCastingDrafts([]);
    setKnownDates(new Set());
    setStatus("done");
    router.refresh();
  };

  const handleCancelConfirm = () => {
    if (parsed) void discardUploadImages(parsed.storagePaths);
    reset();
  };

  const handleConfirm = async () => {
    if (!parsed) return;

    const performances = toConfirmedPerformances(castingDrafts);
    const events = toConfirmedEvents(drafts);

    if (events.some(({ periodStart, periodEnd }) => periodStart > periodEnd)) {
      setError("시작일이 종료일보다 늦은 이벤트가 있어요.");
      return;
    }

    if (performances.length === 0 && events.length === 0) {
      handleCancelConfirm();
      return;
    }

    setError(null);
    await save({ ...parsed, performances }, events);
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
        onChange={handleFileChange}
        className="hidden"
      />

      {status !== "selecting" && (
        <button
          type="button"
          onClick={handleClick}
          disabled={pending || status === "confirming"}
          className="border-border text-text inline-flex w-fit rounded-lg border px-3 py-1 text-xs disabled:opacity-60"
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
        <div className="bg-point/10 flex flex-col gap-3 rounded-4xl p-3">
          <p className="text-text text-xs">
            빼고 싶은 이미지가 있으면 지워주세요. 최대 {MAX_IMAGE_COUNT}장까지
            올릴 수 있어요.
          </p>

          <ul className="flex flex-wrap gap-2">
            {previewUrls.map((url, index) => (
              <li
                key={url}
                className={cn(
                  "flex w-24 flex-col gap-1 rounded-lg border p-1",
                  duplicateIndexes.includes(index)
                    ? "border-destructive"
                    : "border-transparent",
                )}
              >
                <ImageZoom
                  src={url}
                  alt={`${index + 1}번째로 고른 이미지`}
                  className="h-24 w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-text-muted text-xs underline underline-offset-2"
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={files.length === 0}
              className="border-border bg-point text-text rounded-lg border px-3 py-1 text-xs font-bold disabled:opacity-40"
            >
              {files.length}장 올리기
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={files.length >= MAX_IMAGE_COUNT}
              className="border-border text-text rounded-lg border px-3 py-1 text-xs disabled:opacity-40"
            >
              더 고르기
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-text-muted rounded-lg px-3 py-1 text-xs underline underline-offset-2"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {(status === "confirming" || (status === "saving" && !!parsed)) && (
        <UploadConfirmSheet
          open
          castingDrafts={castingDrafts}
          eventDrafts={drafts}
          knownDates={knownDates}
          previewUrls={previewUrls}
          saving={status === "saving"}
          error={error}
          initialTab={reviewTab}
          onCastingChange={setCastingDrafts}
          onEventChange={setDrafts}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}

      {status === "idle" && !error && !result && (
        <ul className="text-text-muted list-inside list-disc text-xs">
          <li>또렷한 사진일수록 좋아요</li>
          <li>이름, 배역이나 이벤트 내용과 날짜가 잘 보이게 찍어주세요</li>
          <li>캡처보다 원본 이미지가 더 빨리 읽혀요</li>
        </ul>
      )}

      {status === "done" && result && (
        <div className="flex flex-col gap-1">
          <p className="text-text text-xs">
            회차 {result.slotCount}개, 배우 {result.actorCount}명, 이벤트{" "}
            {result.eventCount}건을 저장했어요.
          </p>

          {result.skippedCount > 0 && (
            <div className="text-text-muted flex flex-col gap-1 text-xs">
              <p>
                {result.skippedCount}개 행은 확인하지 못해 제외했어요.{" "}
                <button
                  type="button"
                  onClick={() => setShowSkipped((prev) => !prev)}
                  className="underline underline-offset-2"
                >
                  {showSkipped ? "접기" : "보기"}
                </button>
              </p>

              {showSkipped && (
                <ul className="flex flex-col gap-1 text-[11px]">
                  {result.skipped.map((row, index) => (
                    <li key={index}>
                      {row.imageIndex + 1}번째 이미지 — {row.raw.date || "날짜"}{" "}
                      {row.raw.time || ""}·{" "}
                      {PERFORMANCE_SKIP_MESSAGE[row.reason]}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
