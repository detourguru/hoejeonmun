import { Pagination } from "@/components/pagination";
import { ShowCard } from "@/components/show/show-card";
import {
  filterShows,
  getShows,
  paginateShows,
  sortShows,
  type ShowFilters,
} from "@/service/show";

export const ShowList = async ({ filters }: { filters: ShowFilters }) => {
  const shows = sortShows(
    filterShows(await getShows(), filters),
    filters.sort,
  );

  const { items, page, totalPages } = paginateShows(shows, filters.page);

  // TODO: 빈 결과 화면 UI 작업
  if (items.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-text-muted">
        조건에 맞는 공연이 없습니다.
      </p>
    );
  }

  return (
    <>
      <div className="flex-1">
        {items.map((show) => (
          <ShowCard key={show.mt20id} show={show} />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} />
    </>
  );
};
