"use client";

import Image from "next/image";
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
  const [size, setSize] = useState({ width: 1, height: 1 });

  return (
    <>
      <button
        type="button"
        aria-label={`${alt} 크게 보기`}
        onClick={() => dialogRef.current?.showModal()}
        className="block w-full"
      >
        <Image
          unoptimized
          src={src}
          alt={alt}
          width={size.width}
          height={size.height}
          onLoad={({ currentTarget }) =>
            setSize({
              width: currentTarget.naturalWidth,
              height: currentTarget.naturalHeight,
            })
          }
          className={className}
        />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setActualSize(false)}
        className="bg-text/95 backdrop:bg-text/60 m-0 h-dvh max-h-none w-screen max-w-none p-0"
      >
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 p-3">
            <button
              type="button"
              onClick={() => setActualSize(!actualSize)}
              className="border-surface/40 text-surface rounded-lg border px-3 py-1 text-xs"
            >
              {actualSize ? "화면에 맞추기" : "원본 크기로 보기"}
            </button>

            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="border-surface/40 text-surface rounded-lg border px-3 py-1 text-xs"
            >
              닫기
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3">
            <Image
              unoptimized
              src={src}
              alt={alt}
              width={size.width}
              height={size.height}
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
