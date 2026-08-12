"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

// Link로 이동시에는 param이 날아가기 때문에 history 사용
export const BackButton = ({ fallback = "/show" }: { fallback?: string }) => {
  const router = useRouter();

  const goBack = () => {
    // 상세로 바로 진입(공유 링크 등)하면 되감을 히스토리가 없다
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="뒤로 가기"
      className="flex w-fit items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
    >
      <ChevronLeft className="size-4" />
      목록
    </button>
  );
};
