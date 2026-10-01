"use client";

import { ImageZoom } from "@/components/image-zoom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_IMAGE_COUNT } from "@/type/casting";

export const SelectedImagePanel = ({
  previewUrls,
  duplicateIndexes,
  error,
  onRemove,
  onUpload,
  onPickMore,
  onCancel,
}: {
  previewUrls: string[];
  duplicateIndexes: number[];
  error: string | null;
  onRemove: (index: number) => void;
  onUpload: () => void;
  onPickMore: () => void;
  onCancel: () => void;
}) => (
  <div className="bg-point/10 flex flex-col gap-3 rounded-4xl p-3">
    <p className="text-text text-xs">
      빼고 싶은 이미지가 있으면 지워주세요. 최대 {MAX_IMAGE_COUNT}장까지 올릴 수
      있어요.
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
            onClick={() => onRemove(index)}
            className="text-text-muted text-xs underline underline-offset-2"
          >
            빼기
          </button>
        </li>
      ))}
    </ul>

    {error && <p className="text-destructive text-xs">{error}</p>}

    <div className="flex flex-wrap gap-2">
      <Button
        onClick={onUpload}
        disabled={previewUrls.length === 0}
        className="font-bold"
      >
        {previewUrls.length}장 올리기
      </Button>
      <Button
        variant="outline"
        onClick={onPickMore}
        disabled={previewUrls.length >= MAX_IMAGE_COUNT}
      >
        더 고르기
      </Button>
      <Button
        variant="ghost"
        onClick={onCancel}
        className="text-text-muted underline underline-offset-2"
      >
        취소
      </Button>
    </div>
  </div>
);
