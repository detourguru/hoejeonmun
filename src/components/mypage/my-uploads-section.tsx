import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { UploadList } from "@/components/mypage/upload-list";
import { getMyUploads } from "@/service/mypage";

const PREVIEW_COUNT = 1;

export const MyUploadsSection = async ({ userId }: { userId: string }) => {
  const uploads = await getMyUploads(userId);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-text text-lg font-bold">
          내가 최근 올린 캐스팅보드
        </h2>

        {uploads.length > PREVIEW_COUNT && (
          <Link
            href="/mypage/uploads"
            className="text-text-muted hover:text-text flex items-center text-xs"
          >
            전체보기
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>

      <UploadList uploads={uploads.slice(0, PREVIEW_COUNT)} />
    </section>
  );
};
