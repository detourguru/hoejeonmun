"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { discardUploadImages } from "@/app/(main)/show/[id]/actions";
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
import { SelectedImagePanel } from "@/components/show/selected-image-panel";
import { UploadConfirmSheet } from "@/components/show/upload-confirm-sheet";
import { UploadProgress } from "@/components/show/upload-progress";
import { UploadResultSummary } from "@/components/show/upload-result-summary";
import { UploadTutorialDialog } from "@/components/show/upload-tutorial-dialog";
import { useImageSelection } from "@/hook/useImageSelection";
import { useLoginRedirect } from "@/hook/useLoginRedirect";
import { mergeKnownSlots } from "@/lib/known-slots";
import { createClient } from "@/lib/supabase/client";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  ConfirmedEvent,
  DEFAULT_REPORT_TYPE_TAB,
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
  ParsedPerformance,
  PendingEvent,
  ReportTypeTab,
  SkippedPerformance,
  UploadStatus,
} from "@/type/casting";

type ParsedUpload = {
  storagePaths: string[];
  performances: ParsedPerformance[];
  skipped: SkippedPerformance[];
  cancelledSlots: ParsedCancelledSlot[];
  castingChanges: ParsedCastingChange[];
  cancelledEvents: ParsedCancelledEvent[];
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
  const loginRedirect = useLoginRedirect(`/show/${showId}`);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    files,
    previewUrls,
    duplicateIndexes,
    setDuplicateIndexes,
    addFiles,
    removeFile,
    clearFiles,
  } = useImageSelection();
  const [uploadedCount, setUploadedCount] = useState(0);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CastingBoardResult | null>(null);
  const [parsed, setParsed] = useState<ParsedUpload | null>(null);
  const [drafts, setDrafts] = useState<EventDraft[]>([]);
  const [castingDrafts, setCastingDrafts] = useState<CastingDraft[]>([]);
  const [existingSlots, setExistingSlots] = useState<
    { date: string; time: string }[]
  >([]);
  const knownSlots = useMemo(
    () =>
      mergeKnownSlots(existingSlots, toConfirmedPerformances(castingDrafts)),
    [existingSlots, castingDrafts],
  );
  const knownDates = useMemo(
    () => new Set(knownSlots.map(({ date }) => date)),
    [knownSlots],
  );
  const [reviewTab, setReviewTab] = useState<ReportTypeTab>(
    DEFAULT_REPORT_TYPE_TAB,
  );

  const reset = () => {
    clearFiles();
    setUploadedCount(0);
    setResult(null);
    setError(null);
    setParsed(null);
    setDrafts([]);
    setCastingDrafts([]);
    setExistingSlots([]);
    setStatus("idle");
  };

  const handleClick = () => {
    if (!isLoggedIn) {
      loginRedirect("로그인이 필요해요.");
      return;
    }

    if (status === "done") reset();
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (picked.length === 0) return;

    const { message, addedCount } = addFiles(picked);

    setError(message);
    if (addedCount > 0) setStatus("selecting");
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (!userId) {
      loginRedirect("로그인이 필요해요.");
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
      const {
        message,
        duplicateIndexes: duplicates,
        retained,
      } = await parseResponse
        .json()
        .catch(() => ({ message: "분석에 실패했어요." }));

      setStatus("selecting");
      setError(message);
      setDuplicateIndexes(duplicates ?? []);
      if (!retained) void discardUploadImages(storagePaths);
      return;
    }

    const {
      performances,
      events,
      skipped,
      cancelledSlots,
      castingChanges,
      cancelledEvents,
    } = (await parseResponse.json()) as {
      performances: ParsedPerformance[];
      events: PendingEvent[];
      skipped: SkippedPerformance[];
      cancelledSlots: ParsedCancelledSlot[];
      castingChanges: ParsedCastingChange[];
      cancelledEvents: ParsedCancelledEvent[];
    };
    const upload = {
      storagePaths,
      performances,
      skipped,
      cancelledSlots,
      castingChanges,
      cancelledEvents,
    };

    if (performances.length === 0 && events.length === 0) {
      await save(upload, []);
      return;
    }

    if (events.length > 0) {
      const { data: existingSlotRows } = await supabase
        .from("slots")
        .select("date, time")
        .eq("show_id", showId);

      setExistingSlots(existingSlotRows ?? []);
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

    const data: CastingBoardResult = await saveResponse.json();

    if (
      data.cancelledSlotCount > 0 ||
      data.castingChangeCount > 0 ||
      data.cancelledEventCount > 0
    ) {
      toast.success(
        `취소된 회차 ${data.cancelledSlotCount}개, 변경된 캐스팅 ${data.castingChangeCount}건, 취소된 이벤트 ${data.cancelledEventCount}건을 반영했어요.`,
      );
    }

    setResult(data);
    setParsed(null);
    setDrafts([]);
    setCastingDrafts([]);
    setExistingSlots([]);
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
        <SelectedImagePanel
          previewUrls={previewUrls}
          duplicateIndexes={duplicateIndexes}
          error={error}
          onRemove={removeFile}
          onUpload={handleUpload}
          onPickMore={() => inputRef.current?.click()}
          onCancel={reset}
        />
      )}

      <UploadTutorialDialog isLoggedIn={isLoggedIn} />

      {(status === "confirming" || (status === "saving" && !!parsed)) && (
        <UploadConfirmSheet
          open
          castingDrafts={castingDrafts}
          eventDrafts={drafts}
          knownDates={knownDates}
          knownSlots={knownSlots}
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

      {status === "done" && result && <UploadResultSummary result={result} />}
    </div>
  );
};
