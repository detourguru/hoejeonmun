"use client";

import Image from "next/image";
import { useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

export const OriginalImages = ({ images }: { images: string[] }) => {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);

  if (images.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-fit text-[10px] text-text-muted underline underline-offset-2"
      >
        {open ? "원본 접기" : "원본 보기"}
      </button>

      {open && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setZoomed(url)}
              className="overflow-hidden rounded border border-border"
            >
              <Image
                src={url}
                alt={`원본 캐스팅보드 ${index + 1}`}
                width={80}
                height={80}
                className="h-20 w-20 object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={zoomed !== null}
        onOpenChange={(next) => !next && setZoomed(null)}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] bg-surface p-2 sm:max-w-2xl">
          {zoomed && (
            <Image
              src={zoomed}
              alt="원본 캐스팅보드 확대"
              width={1200}
              height={1600}
              className="h-auto max-h-[80vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
