"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  EventConfirmList,
  EventDraft,
  toConfirmedEvents,
  toEventDrafts,
} from "@/components/show/event-confirm-list";
import { createClient } from "@/lib/supabase/client";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  ConfirmedEvent,
  MAX_IMAGE_BYTES,
  ParsedPerformance,
  PendingEvent,
} from "@/type/casting";

type Status =
  | "idle"
  | "uploading"
  | "analyzing"
  | "confirming"
  | "saving"
  | "done";

const STATUS_LABEL: Record<Status, string> = {
  idle: "캐스팅보드/이벤트 제보하기",
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

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CastingBoardResult | null>(null);
  const [parsed, setParsed] = useState<ParsedUpload | null>(null);
  const [drafts, setDrafts] = useState<EventDraft[]>([]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleClick = () => {
    if (!isLoggedIn) {
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

    const { performances, events, skippedCount } = (await parseResponse.json()) as {
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

      setStatus(parsed ? "confirming" : "idle");
      setError(message);
      return;
    }

    setResult(await saveResponse.json());
    setStatus("done");
    setParsed(null);
    setDrafts([]);

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
      setStatus("idle");
      setParsed(null);
      setDrafts([]);
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

      <button
        type="button"
        onClick={handleClick}
        disabled={pending || status === "confirming"}
        className="inline-flex w-fit rounded-4xl border border-border px-3 py-1 text-xs text-text transition-colors hover:bg-point disabled:opacity-60"
      >
        {STATUS_LABEL[status]}
      </button>

      {status === "confirming" && (
        <div className="flex flex-col gap-3 rounded-lg bg-point/10 p-3">
          <p className="text-xs text-text">
            읽어낸 이벤트예요. 날짜가 맞는지 봐주시면 그대로 올라가요.
          </p>

          <EventConfirmList drafts={drafts} onChange={setDrafts} />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex rounded-4xl border border-border px-3 py-1 text-xs text-text transition-colors hover:bg-point"
            >
              이대로 저장하기
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setParsed(null);
                setDrafts([]);
              }}
              className="inline-flex rounded-4xl px-3 py-1 text-xs text-text-muted underline underline-offset-2"
            >
              취소
            </button>
          </div>
        </div>
      )}

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
