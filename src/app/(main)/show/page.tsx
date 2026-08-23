import Link from "next/link";
import { Suspense } from "react";

import { RecentCastingCard } from "@/components/show/recent-casting-card";
import { RecentEventCard } from "@/components/show/recent-event-card";
import { LoadingGhost } from "@/components/ui/loading-ghost";
import { cn } from "@/lib/utils";
import { getRecentEvents, getRecentUploadedShows } from "@/service/casting";
import { getShow } from "@/service/show";
import { DEFAULT_FEED_TAB, FEED_TAB } from "@/type/casting";

const FEED_LIMIT = 10;

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function Page({ searchParams }: Props) {
  const { tab: rawTab } = await searchParams;
  const tab = FEED_TAB.isCode(rawTab) ? rawTab : DEFAULT_FEED_TAB;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-primary/60 text-[11px] font-bold tracking-widest uppercase">
          Latest Updates
        </p>
        <h2 className="text-text text-lg font-bold">최근 소식</h2>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="bg-sub flex gap-0.5 rounded-xl p-0.5">
          {FEED_TAB.options.map(({ value, label }) => (
            <Link
              key={value}
              href={`/show?tab=${value}`}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                value === tab
                  ? "bg-surface text-primary shadow-sm"
                  : "text-text-muted hover:text-text",
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        <Link
          href="/show/all"
          className="group text-primary flex items-center gap-1 text-xs font-medium"
        >
          필터로 찾기
          <svg
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M9 18l6-6-6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

      <Suspense key={tab} fallback={<LoadingGhost />}>
        {tab === "casting" ? <CastingFeed /> : <EventFeed />}
      </Suspense>
    </div>
  );
}

async function CastingFeed() {
  const recent = await getRecentUploadedShows(FEED_LIMIT);

  const resolved = await Promise.all(
    recent.map(async ({ showId, uploadedAt }) => {
      const show = await getShow(showId);
      return show ? { show, uploadedAt } : null;
    }),
  );

  const items = resolved.filter((item) => item !== null);

  if (items.length === 0) return <EmptyFeed />;

  return (
    <div className="flex flex-col gap-3">
      {items.map(({ show, uploadedAt }) => (
        <RecentCastingCard
          key={show.mt20id}
          show={show}
          uploadedAt={uploadedAt}
        />
      ))}
    </div>
  );
}

async function EventFeed() {
  const events = await getRecentEvents(FEED_LIMIT);

  const resolved = await Promise.all(
    events.map(async (event) => {
      const show = await getShow(event.showId);
      return show ? { show, event } : null;
    }),
  );

  const items = resolved.filter((item) => item !== null);

  if (items.length === 0) return <EmptyFeed />;

  return (
    <div className="flex flex-col gap-3">
      {items.map(({ show, event }) => (
        <RecentEventCard key={event.id} show={show} event={event} />
      ))}
    </div>
  );
}

const EmptyFeed = () => (
  <div className="flex flex-col items-center gap-1 py-16 text-center">
    <div className="bg-sub mb-3 flex h-16 w-16 items-center justify-center rounded-full">
      <span className="text-text-muted font-serif text-2xl">幕</span>
    </div>
    <p className="text-text font-medium">아직 아무것도 올라오지 않았어요</p>
    <p className="text-text-muted mb-2 text-sm">첫 번째 제보자가 되어볼까요?</p>
    <Link
      href="/show/all"
      className="border-primary/30 text-primary hover:bg-primary mt-2 inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:text-white"
    >
      전체 공연 목록 둘러보기
    </Link>
  </div>
);
