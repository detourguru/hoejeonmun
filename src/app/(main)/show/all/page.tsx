import { Suspense } from "react";

import { FilterBar } from "@/components/show/filter-bar";
import { ShowList } from "@/components/show/show-list";
import { LoadingGhost } from "@/components/ui/loading-ghost";
import { parseShowFilters } from "@/service/show";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공연 전체 목록",
  description: "진행중·개막예정 뮤지컬·연극을 필터로 찾아보세요",
  alternates: { canonical: "/show/all" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parseShowFilters(await searchParams);

  return (
    <div className="flex flex-col">
      <FilterBar />

      {/* TODO: 예외처리 추가 필요 */}
      <Suspense fallback={<LoadingGhost />}>
        <ShowList filters={filters} />
      </Suspense>
    </div>
  );
}
