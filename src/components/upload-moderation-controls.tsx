"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  moderateUpload,
  previewUploadModeration,
} from "@/app/(main)/show/[id]/moderation-actions";
import { BottomSheet } from "@/components/bottom-sheet";

type Preview = Awaited<ReturnType<typeof previewUploadModeration>>;

export function UploadModerationControls({ uploadId }: { uploadId: number }) {
  const [open, setOpen] = useState(false);
  const [allUploads, setAllUploads] = useState(false);
  const [ban, setBan] = useState(false);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const loadPreview = () => {
    setError("");
    startTransition(async () => {
      try {
        setPreview(await previewUploadModeration(uploadId, allUploads));
      } catch {
        setError("대상 업로드와 운영자 권한을 확인해 주세요.");
      }
    });
  };
  const execute = () => {
    if (!preview) return;
    startTransition(async () => {
      const result = await moderateUpload({
        uploadId,
        allUploads,
        ban,
        reason,
        expectedIds: preview.uploads.map((u) => u.id),
      });
      if (!result.ok) {
        setError(result.message);
        setPreview(null);
        return;
      }
      setOpen(false);
      toast.success(
        `${result.deleted}건을 삭제했어요.${ban ? " 업로드를 차단했어요." : ""}`,
      );
    });
  };
  return (
    <>
      <button
        type="button"
        className="text-destructive text-xs underline"
        onClick={() => {
          setOpen(true);
          setPreview(null);
          setAllUploads(false);
          setBan(false);
          setReason("");
          setError("");
        }}
      >
        업로드 운영 조치
      </button>
      <BottomSheet
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title="업로드 삭제 및 차단"
      >
        <p>
          기본값은 현재 업로드만 삭제예요. 다른 사용자의 제보와 담아 둔 회차는
          보존해요. 삭제한 원본은 복구할 수 없어요.
        </p>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={allUploads}
            disabled={pending}
            onChange={(e) => {
              setAllUploads(e.target.checked);
              setPreview(null);
            }}
          />
          이 사용자의 전체 업로드 삭제
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={ban}
            disabled={pending}
            onChange={(e) => {
              setBan(e.target.checked);
              setPreview(null);
            }}
          />
          향후 업로드 차단 (로그인·신고·정정은 유지)
        </label>
        <label>
          조치 사유
          <textarea
            className="border-border mt-1 w-full rounded border p-2"
            maxLength={1000}
            value={reason}
            disabled={pending}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button type="button" disabled={pending} onClick={loadPreview}>
          삭제 범위 확인
        </button>
        {preview && (
          <div className="border-border rounded border p-3">
            <p className="break-all">대상 사용자: {preview.userId}</p>
            <p>
              업로드 {preview.uploads.length}건 · 공연{" "}
              {new Set(preview.uploads.map((u) => u.show_id)).size}개 · 차단{" "}
              {ban ? "적용" : "변경 없음"}
            </p>
            <ul>
              {preview.uploads.map((u) => (
                <li key={u.id}>
                  #{u.id} {u.show_title || u.show_id}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="text-destructive mt-3"
              disabled={
                pending || !reason.trim() || preview.uploads.length === 0
              }
              onClick={execute}
            >
              위 범위로 삭제 확정
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </BottomSheet>
    </>
  );
}
