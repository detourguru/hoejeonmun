import { Suspense } from "react";

import { FilterBar } from "@/components/show/filter-bar";
import { ShowList } from "@/components/show/show-list";
import { parseShowFilters } from "@/service/show";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parseShowFilters(await searchParams);

  return (
    <div className="flex flex-col">
      <FilterBar />

      {/* TODO: 로딩, 예외처리 추가 필요 */}
      <Suspense
        fallback={
          <p className="py-16 text-center text-sm text-text-muted">
            불러오는 중...
          </p>
        }
      >
        <ShowList filters={filters} />
      </Suspense>
    </div>
  );
}
