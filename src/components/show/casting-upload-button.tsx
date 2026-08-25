"use client";

import { Check, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { OriginalImages } from "@/components/casting/original-images";
import {
  CastingConfirmList,
  CastingDraft,
  toCastingDrafts,
  toConfirmedPerformances,
} from "@/components/show/casting-confirm-list";
import {
  EventConfirmList,
  EventDraft,
  toConfirmedEvents,
  toEventDrafts,
} from "@/components/show/event-confirm-list";
import { LoadingGhost } from "@/components/ui/loading-ghost";
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
  REPORT_TYPE_TAB,
  ReportTypeTab,
} from "@/type/casting";

type Status =
  | "idle"
  | "selecting"
  | "uploading"
  | "analyzing"
  | "confirming"
  | "saving"
  | "done";

const SHEET_TITLE: Record<Exclude<Status, "idle">, string> = {
  selecting: "이미지 선택",
  uploading: "이미지 올리는 중",
  analyzing: "표 읽는 중",
  confirming: "제보 확인",
  saving: "저장하는 중",
  done: "저장 완료",
};

const UPLOAD_STEPS = [
  "selecting",
  "uploading",
  "analyzing",
  "confirming",
  "saving",
  "done",
] as const;

const UPLOAD_STEP_LABEL: Record<(typeof UPLOAD_STEPS)[number], string> = {
  selecting: "선택",
  uploading: "업로드",
  analyzing: "분석",
  confirming: "확인",
  saving: "저장",
  done: "완료",
};

const UploadStepBar = ({ status }: { status: Status }) => {
  const currentIndex = UPLOAD_STEPS.indexOf(
    status as (typeof UPLOAD_STEPS)[number],
  );

  return (
    <div className="bg-sub flex items-center gap-1 overflow-x-auto rounded-lg px-3 py-2">
      {UPLOAD_STEPS.map((step, index) => {
        const isPast = currentIndex > index;
        const isActive = currentIndex === index;

        return (
          <div key={step} className="flex shrink-0 items-center">
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  isPast && "border-primary bg-primary text-white",
                  isActive && "border-primary text-primary",
                  !isPast && !isActive && "border-border text-text-muted",
                )}
              >
                {isPast ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "text-[10px]",
                  isActive && "text-primary font-bold",
                  isPast && "text-primary",
                  !isPast && !isActive && "text-text-muted",
                )}
              >
                {UPLOAD_STEP_LABEL[step]}
              </span>
            </div>

            {index < UPLOAD_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px w-4",
                  isPast ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

const LOADING_LABEL = {
  uploading: "이미지 올리는 중…",
  analyzing: "표 읽는 중…",
  saving: "저장하는 중…",
} as const;

const ANALYZE_TIMEOUT_SECONDS = 60;

const LoadingPanel = ({
  status,
  secondsLeft,
}: {
  status: keyof typeof LOADING_LABEL;
  secondsLeft: number;
}) => (
  <div className="flex flex-col items-center gap-1">
    <LoadingGhost className="py-4" label={LOADING_LABEL[status]} />

    {status === "analyzing" && (
      <p className="text-text-muted text-xs">
        최대 {ANALYZE_TIMEOUT_SECONDS}초 정도 걸려요 / 약 {secondsLeft}초 남음
      </p>
    )}
  </div>
);

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
  const [duplicateIndexes, setDuplicateIndexes] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CastingBoardResult | null>(null);
  const [parsed, setParsed] = useState<ParsedUpload | null>(null);
  const [drafts, setDrafts] = useState<EventDraft[]>([]);
  const [castingDrafts, setCastingDrafts] = useState<CastingDraft[]>([]);
  const [analyzeSecondsLeft, setAnalyzeSecondsLeft] = useState(
    ANALYZE_TIMEOUT_SECONDS,
  );
  const [reviewTab, setReviewTab] = useState<ReportTypeTab>(
    DEFAULT_REPORT_TYPE_TAB,
  );

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  });

  useEffect(() => {
    if (status !== "analyzing") return;

    const interval = setInterval(() => {
      setAnalyzeSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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

    setFiles((prev) => [...prev, ...accepted]);
    setPreviewUrls((prev) => [
      ...prev,
      ...accepted.map((file) => URL.createObjectURL(file)),
    ]);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles((prev) => prev.filter((_, at) => at !== index));
    setPreviewUrls((prev) => prev.filter((_, at) => at !== index));
    setDuplicateIndexes([]);
  };

  const resetToIdle = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviewUrls([]);
    setDuplicateIndexes([]);
    setResult(null);
    setError(null);
    setParsed(null);
    setDrafts([]);
    setCastingDrafts([]);
    setStatus("idle");
  };

  const handleOpen = () => {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
      return;
    }

    setResult(null);
    setError(null);
    setStatus("selecting");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);

    event.target.value = "";

    if (picked.length > 0) addFiles(picked);
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;

    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (!userId) {
      router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
      return;
    }

    setError(null);
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
    }

    setAnalyzeSecondsLeft(ANALYZE_TIMEOUT_SECONDS);
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

      return;
    }

    const { performances, events, skippedCount } =
      (await parseResponse.json()) as {
        performances: ParsedPerformance[];
        events: PendingEvent[];
        skippedCount: number;
      };

    const upload = { storagePaths, performances, skippedCount };

    if (performances.length === 0 && events.length === 0) {
      await save(upload, []);
      return;
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
    setStatus("done");
    setParsed(null);
    setDrafts([]);
    setCastingDrafts([]);

    // 저장된 회차가 캐스팅보드 영역에 바로 보이도록
    router.refresh();
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
      resetToIdle();
      return;
    }

    setError(null);

    await save({ ...parsed, performances }, events);
  };

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

      <button
        type="button"
        onClick={handleOpen}
        className="border-border text-text hover:bg-point inline-flex w-fit rounded-4xl border px-3 py-1 text-xs transition-colors"
      >
        {status === "done" ? "추가 제보하기" : "캐스팅보드/이벤트 제보하기"}
      </button>

      {status === "idle" && (
        <ul className="text-text-muted list-inside list-disc text-xs">
          <li>또렷한 사진일수록 좋아요</li>
          <li>이름, 배역이나 이벤트 내용과 날짜가 잘 보이게 찍어주세요</li>
          <li>캡처보다 원본 이미지가 더 빨리 읽혀요</li>
        </ul>
      )}

      <BottomSheet
        open={status !== "idle"}
        onOpenChange={(open, eventDetails) => {
          if (open) return;

          const pending =
            status === "uploading" ||
            status === "analyzing" ||
            status === "saving";

          if (pending) {
            eventDetails.cancel();
            return;
          }

          resetToIdle();
        }}
        title={status === "idle" ? "" : SHEET_TITLE[status]}
      >
        <div className="flex flex-col gap-3">
          <UploadStepBar status={status} />

          {status === "selecting" && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={previewUrls.length >= MAX_IMAGE_COUNT}
                className="border-border hover:border-primary/40 hover:bg-point/10 rounded-lg border-2 border-dashed p-6 text-center transition-colors disabled:pointer-events-none disabled:opacity-40"
              >
                <Upload className="text-text-muted mx-auto mb-2 h-6 w-6" />
                <p className="text-text text-sm font-bold">
                  이미지를 선택해 주세요
                </p>
                <p className="text-text-muted mt-0.5 text-xs">
                  캐스팅표/이벤트 안내 이미지 최대 {MAX_IMAGE_COUNT}장 / 장당
                  10MB 이하
                </p>
              </button>

              {previewUrls.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {previewUrls.map((url, index) => (
                    <div
                      key={url}
                      className={cn(
                        "bg-sub relative h-16 w-16 overflow-hidden rounded-lg border",
                        duplicateIndexes.includes(index)
                          ? "border-destructive border-2"
                          : "border-border",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`선택한 이미지 ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        aria-label="이미지 제거"
                        className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}

                  {previewUrls.length < MAX_IMAGE_COUNT && (
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      aria-label="이미지 추가"
                      className="border-border text-text-muted hover:border-primary/40 hover:text-primary flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed transition-colors"
                    >
                      +
                    </button>
                  )}

                  <span className="text-text-muted text-xs">
                    {previewUrls.length}/{MAX_IMAGE_COUNT}장
                  </span>
                </div>
              )}

              {error && <p className="text-destructive text-xs">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetToIdle}
                  className="border-border text-text-muted hover:text-text flex-1 rounded-4xl border py-2 text-xs transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={files.length === 0}
                  className="bg-primary flex-1 rounded-4xl py-2 text-xs font-bold text-white transition-colors disabled:opacity-40"
                >
                  {files.length === 0
                    ? "이미지를 선택해 주세요"
                    : `${files.length}장 올리기`}
                </button>
              </div>
            </div>
          )}

          {(status === "uploading" ||
            status === "analyzing" ||
            status === "saving") && (
            <LoadingPanel status={status} secondsLeft={analyzeSecondsLeft} />
          )}

          {status === "confirming" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-1 justify-center">
                <div className="flex gap-1">
                  {REPORT_TYPE_TAB.options.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReviewTab(value)}
                      className={cn(
                        "border-border rounded-4xl border px-3 py-1 text-xs transition-colors",
                        value === reviewTab
                          ? "bg-primary text-white"
                          : "text-text",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-text text-xs">
                읽어낸 내용이에요. 맞는지 봐주시면 그대로 올라가요.
              </p>

              <div>
                <p className="text-text-muted mb-1 text-[10px] font-bold">
                  원본 이미지와 대조해서 확인하세요
                </p>
                <OriginalImages images={previewUrls} />
              </div>

              {reviewTab === "casting" &&
                (castingDrafts.length > 0 ? (
                  <CastingConfirmList
                    drafts={castingDrafts}
                    onChange={setCastingDrafts}
                  />
                ) : (
                  <p className="text-text-muted text-xs">
                    읽어낸 캐스팅이 없어요.
                  </p>
                ))}

              {reviewTab === "event" &&
                (drafts.length > 0 ? (
                  <EventConfirmList drafts={drafts} onChange={setDrafts} />
                ) : (
                  <p className="text-text-muted text-xs">
                    읽어낸 이벤트가 없어요.
                  </p>
                ))}

              {error && <p className="text-destructive text-xs">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetToIdle}
                  className="border-border text-text-muted hover:text-text flex-1 rounded-4xl border py-2 text-xs transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="bg-primary flex-1 rounded-4xl py-2 text-xs font-bold text-white transition-colors"
                >
                  이대로 저장하기
                </button>
              </div>
            </div>
          )}

          {status === "done" && result && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="bg-point flex h-14 w-14 items-center justify-center rounded-full">
                <Check className="text-primary h-7 w-7" />
              </div>

              <p className="text-text text-base font-bold">저장됐어요!</p>

              <p className="text-text-muted text-xs leading-relaxed">
                {result.slotCount > 0 &&
                  `회차 ${result.slotCount}개, 배우 ${result.actorCount}명`}
                {result.slotCount > 0 && result.eventCount > 0 && ", "}
                {result.eventCount > 0 && `이벤트 ${result.eventCount}건`}을
                저장했어요.
                {result.skippedCount > 0 && (
                  <span className="block">
                    읽지 못한 행 {result.skippedCount}개는 건너뛰었어요.
                  </span>
                )}
              </p>

              <button
                type="button"
                onClick={resetToIdle}
                className="border-border text-text hover:bg-point mt-2 rounded-4xl border px-4 py-2 text-xs transition-colors"
              >
                닫기
              </button>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
};
