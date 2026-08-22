import { Suspense } from "react";

import { FilterBar } from "@/components/show/filter-bar";
import { ShowList } from "@/components/show/show-list";
import { LoadingGhost } from "@/components/ui/loading-ghost";
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

      {/* TODO: 예외처리 추가 필요 */}
      <Suspense fallback={<LoadingGhost />}>
        <ShowList filters={filters} />
      </Suspense>
    </div>
  );
}
