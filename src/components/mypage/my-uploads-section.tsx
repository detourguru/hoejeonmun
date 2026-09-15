import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { UploadList } from "@/components/mypage/upload-list";
import { LoadingGhost } from "@/components/ui/loading-ghost";
import { getMyRecentUploads } from "@/service/mypage";

const PREVIEW_COUNT = 1;

export const MyUploadsSection = async ({ userId }: { userId: string }) => {
  const { uploads, hasMore } = await getMyRecentUploads(userId, PREVIEW_COUNT);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionTitle />

        {hasMore && (
          <Link
            href="/mypage/uploads"
            className="text-text-muted hover:text-text flex items-center text-xs"
          >
            전체보기
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>

      <UploadList uploads={uploads} />
    </section>
  );
};

const SectionTitle = () => (
  <h2 className="text-text text-lg font-bold">내가 최근 올린 캐스팅보드</h2>
);

export const MyUploadsSectionLoading = () => (
  <section className="flex flex-col gap-3">
    <SectionTitle />
    <LoadingGhost className="py-4" label="캐스팅보드 불러오는 중..." />
  </section>
);
