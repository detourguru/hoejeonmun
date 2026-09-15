import { Pagination } from "@/components/pagination";
import { ShowCard } from "@/components/show/show-card";
import { getLatestUploadsByShowIds } from "@/service/casting";
import { withPosterThumbnails } from "@/service/poster-thumbnail";
import {
  filterShows,
  filterShowsByVenue,
  getShows,
  paginateShows,
  sortShows,
  type ShowFilters,
} from "@/service/show";

export const ShowList = async ({ filters }: { filters: ShowFilters }) => {
  const filteredShows = filterShows(await getShows(), filters);
  const shows = sortShows(
    await filterShowsByVenue(filteredShows, filters),
    filters.sort,
  );

  const { items, page, totalPages } = paginateShows(shows, filters.page);

  // TODO: 빈 결과 화면 UI 작업
  if (items.length === 0) {
    return (
      <p className="text-text-muted py-16 text-center text-sm">
        조건에 맞는 공연이 없습니다.
      </p>
    );
  }

  const [latestUploads, itemsWithThumbnail] = await Promise.all([
    getLatestUploadsByShowIds(items.map((show) => show.mt20id)),
    withPosterThumbnails(items),
  ]);

  return (
    <>
      <div className="flex-1">
        {itemsWithThumbnail.map((show, index) => (
          <ShowCard
            key={show.mt20id}
            show={show}
            lastUpdatedAt={latestUploads.get(show.mt20id) ?? null}
            priority={index === 0}
          />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} />
    </>
  );
};
