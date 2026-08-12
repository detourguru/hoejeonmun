"use client";

import { useEffect, useRef, useState } from "react";

export const CastingUploadButton = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

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
        className="inline-flex w-fit rounded-4xl border border-border px-3 py-1 text-xs text-text transition-colors hover:bg-point"
      >
        캐스팅보드 제보하기
      </button>

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
