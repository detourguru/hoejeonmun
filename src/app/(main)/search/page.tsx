import Link from "next/link";

import { ShowCard } from "@/components/show/show-card";
import { searchActors } from "@/service/actor";
import { searchShows } from "@/service/show";

import type { Metadata } from "next";

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const keyword = q?.trim();

  return {
    title: keyword ? `'${keyword}' 검색 결과` : "검색",
    robots: { index: false, follow: true },
  };
}

const Section = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-text text-sm font-bold">
      {title} <span className="text-text-muted">{count}</span>
    </h2>
    {children}
  </section>
);

export default async function Page({ searchParams }: Props) {
  const { q } = await searchParams;
  const keyword = q?.trim() ?? "";

  if (!keyword) {
    return (
      <p className="text-text-muted py-16 text-center text-sm">
        공연명이나 배우 이름을 검색해 보세요.
      </p>
    );
  }

  const [actors, shows] = await Promise.all([
    searchActors(keyword),
    searchShows(keyword),
  ]);

  if (actors.length === 0 && shows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-text-muted text-sm">
          &lsquo;{keyword}&rsquo; 검색 결과가 없어요.
        </p>
        <p className="text-text-muted text-xs">
          배우는 제보된 캐스팅보드에 등장한 이름만 검색돼요.
        </p>
        <Link
          href="/show"
          className="bg-primary rounded-full px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
        >
          공연 검색하기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {actors.length > 0 && (
        <Section title="배우" count={actors.length}>
          <ul className="flex flex-col gap-2">
            {actors.map(({ id, name }) => (
              <li key={id}>
                <Link
                  href={`/actor/${id}`}
                  className="border-border bg-surface text-text hover:bg-point flex rounded-lg border p-3 text-sm transition-colors"
                >
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {shows.length > 0 && (
        <Section title="공연" count={shows.length}>
          <div>
            {shows.map((show) => (
              <ShowCard key={show.mt20id} show={show} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
