"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { useUpdateSearchParams } from "@/hook/useUpdateSearchParams";

export const Pagination = ({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) => {
  const updateSearchParams = useUpdateSearchParams();

  // 1페이지일때는 param에 포함안함
  const moveTo = (next: number) => {
    updateSearchParams({ page: next === 1 ? null : String(next) });

    // 스크롤 위치 초기화
    window.scrollTo({ top: 0 });
  };

  const buttonClassName =
    "flex size-9 items-center justify-center rounded-full text-text transition-colors disabled:opacity-30 enabled:hover:bg-point";

  return (
    <nav
      className="border-border bg-sub/90 sticky bottom-0 -mx-4 flex items-center justify-center gap-2 border-t px-4 py-2 backdrop-blur"
      aria-label="페이지 이동"
    >
      <button
        type="button"
        className={buttonClassName}
        disabled={page <= 1}
        onClick={() => moveTo(page - 1)}
        aria-label="이전 페이지"
      >
        <ChevronLeft className="size-5" />
      </button>

      <p className="text-text min-w-16 text-center text-sm tabular-nums">
        {page} / {totalPages}
      </p>

      <button
        type="button"
        className={buttonClassName}
        disabled={page >= totalPages}
        onClick={() => moveTo(page + 1)}
        aria-label="다음 페이지"
      >
        <ChevronRight className="size-5" />
      </button>
    </nav>
  );
};
