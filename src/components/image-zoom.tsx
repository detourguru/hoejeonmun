"use client";

import { useRef, useState } from "react";

export const ImageZoom = ({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [actualSize, setActualSize] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`${alt} 크게 보기`}
        onClick={() => dialogRef.current?.showModal()}
        className="block w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setActualSize(false)}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 backdrop:bg-black/60"
      >
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 p-3">
            <button
              type="button"
              onClick={() => setActualSize(!actualSize)}
              className="rounded-4xl border border-white/40 px-3 py-1 text-xs text-white"
            >
              {actualSize ? "화면에 맞추기" : "원본 크기로 보기"}
            </button>

            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-4xl border border-white/40 px-3 py-1 text-xs text-white"
            >
              닫기
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className={
                actualSize
                  ? "max-w-none"
                  : "mx-auto max-h-full max-w-full object-contain"
              }
            />
          </div>
        </div>
      </dialog>
    </>
  );
};
