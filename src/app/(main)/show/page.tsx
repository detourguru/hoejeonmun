import { redirect } from "next/navigation";

import { getKopis } from "@/lib/kopis";
import { Show } from "@/type/show";
import { ShowCard } from "@/components/show/show-card";
import { FilterBar } from "@/components/show/filter-bar";

const DEFAULT_FILTERS = {
  prfstate: "02",
};

const SORT_COMPARATORS = {
  openDate: (a: Show, b: Show) => a.prfpdfrom.localeCompare(b.prfpdfrom),
  closeDate: (a: Show, b: Show) => a.prfpdto.localeCompare(b.prfpdto),
};

type SortKey = keyof typeof SORT_COMPARATORS;

const isSortKey = (value: unknown): value is SortKey =>
  typeof value === "string" && value in SORT_COMPARATORS;

const toKopisDate = (date: Date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;

function withRequiredParams(params: URLSearchParams) {
  const today = new Date();
  const oneYearLater = new Date(today);
  oneYearLater.setFullYear(today.getFullYear() + 1);

  const defaults = {
    stdate: toKopisDate(today),
    eddate: toKopisDate(oneYearLater),
    cpage: "1",
    rows: "30",
  };

  Object.entries(defaults).forEach(([key, value]) => {
    if (!params.has(key)) params.set(key, value);
  });

  return params;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  if (Object.keys(params).length === 0) {
    redirect(`/show?${new URLSearchParams(DEFAULT_FILTERS)}`);
  }

  const queryParams = withRequiredParams(
    new URLSearchParams(params as Record<string, string>),
  );
  queryParams.delete("sort");

  const data: Show[] = await getKopis("/pblprfr", queryParams);

  const shows = data.filter((show) => show?.mt20id);

  if (isSortKey(params.sort)) shows.sort(SORT_COMPARATORS[params.sort]);

  return (
    <div>
      <FilterBar />

      {shows.map((show) => (
        <ShowCard key={show.mt20id} show={show} />
      ))}
    </div>
  );
}
