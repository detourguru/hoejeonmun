"use client";

import { useElapsedSeconds } from "@/hook/useElapsedSeconds";
import { cn } from "@/lib/utils";
import {
  PARSE_TIMEOUT_SECONDS,
  UPLOAD_STEP,
  UploadStatus,
} from "@/type/casting";

export const UploadProgress = ({
  status,
  uploadedCount,
  totalCount,
}: {
  status: UploadStatus;
  uploadedCount: number;
  totalCount: number;
}) => {
  const waiting =
    status === "uploading" || status === "analyzing" || status === "saving";

  const seconds = useElapsedSeconds(waiting);

  if (!UPLOAD_STEP.isCode(status)) return null;

  const current = UPLOAD_STEP.codes.indexOf(status);

  const currentRatio =
    status === "uploading" && totalCount > 0 ? uploadedCount / totalCount : 1;

  const detail = {
    selecting: `이미지 ${totalCount}장을 담았어요.`,
    uploading: `이미지 ${uploadedCount} / ${totalCount}장 올렸어요.`,
    analyzing: `표를 읽고 있어요. ${seconds}초 / 최대 ${PARSE_TIMEOUT_SECONDS}초`,
    confirming: "읽어낸 이벤트를 확인해 주세요.",
    saving: `저장하고 있어요. ${seconds}초째 기다리는 중이에요.`,
  }[status];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <ol className="flex gap-1">
        {UPLOAD_STEP.options.map(({ value, label }, at) => (
          <li key={value} className="flex flex-1 flex-col gap-1">
            <span className="block h-1 overflow-hidden rounded-full bg-border">
              <span
                className={cn(
                  "block h-full rounded-full bg-primary transition-[width] duration-500",
                  at === current && waiting && "animate-pulse",
                )}
                style={{
                  width:
                    at < current
                      ? "100%"
                      : at > current
                        ? "0%"
                        : `${currentRatio * 100}%`,
                }}
              />
            </span>

            <span
              className={cn(
                "text-[10px]",
                at === current ? "font-bold text-text" : "text-text-muted",
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-xs text-text-muted">{detail}</p>
    </div>
  );
};
