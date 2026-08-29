import Link from "next/link";
import { Suspense } from "react";

import { FavoriteActorShowCard } from "@/components/show/favorite-actor-show-card";
import { RecentCastingCard } from "@/components/show/recent-casting-card";
import { RecentEventCard } from "@/components/show/recent-event-card";
import { LoadingGhost } from "@/components/ui/loading-ghost";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getShowsWithFavoritedActors } from "@/service/actor";
import {
  getRecentEvents,
  getRecentUploadedShows,
  RecentEvent,
} from "@/service/casting";
import { getShow, getShows } from "@/service/show";
import { DEFAULT_SHOW_FEED_TAB, SHOW_FEED_TAB, type Show } from "@/type/show";

import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/show" },
};

const FEED_LIMIT = 10;

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function Page({ searchParams }: Props) {
  const { tab: rawTab } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(auth?.claims);
  const defaultTab = isLoggedIn ? DEFAULT_SHOW_FEED_TAB : "recent";
  const tab = SHOW_FEED_TAB.isCode(rawTab) ? rawTab : defaultTab;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-primary/60 text-[11px] font-bold tracking-widest uppercase">
          Discover
        </p>
        <h2 className="text-text text-lg font-bold">둘러보기</h2>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="bg-sub flex gap-0.5 rounded-xl p-0.5">
          {SHOW_FEED_TAB.options.map(({ value, label }) => (
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
        {tab === "favorite" ? <FavoriteActorFeed /> : <RecentFeed />}
      </Suspense>
    </div>
  );
}

function indexShowsById(shows: Show[]) {
  return new Map(shows.map((show) => [show.mt20id, show]));
}

// 기조회된 데이터 안에 없을땐 별도 조회
async function fillMissingShows(
  showById: Map<string, Show>,
  showIds: string[],
) {
  const missingIds = [...new Set(showIds)].filter((id) => !showById.has(id));

  if (missingIds.length === 0) return showById;

  const fetched = await Promise.all(missingIds.map((id) => getShow(id)));
  const merged = new Map(showById);

  missingIds.forEach((id, index) => {
    const show = fetched[index];
    if (show) merged.set(id, show);
  });

  return merged;
}

async function FavoriteActorFeed() {
  const [favoritedShows, shows] = await Promise.all([
    getShowsWithFavoritedActors(),
    getShows(),
  ]);

  const showById = await fillMissingShows(
    indexShowsById(shows),
    favoritedShows.map(({ showId }) => showId),
  );

  const items = favoritedShows
    .map((favorited) => {
      const show = showById.get(favorited.showId);
      return show ? { ...favorited, show } : null;
    })
    .filter((item) => item !== null);

  if (items.length === 0) return <EmptyFavoriteFeed />;

  return (
    <div className="flex flex-col gap-3">
      {items.map(({ show, showId, actorNames, nearestDate }, index) => (
        <FavoriteActorShowCard
          key={showId}
          show={show}
          actorNames={actorNames}
          nearestDate={nearestDate}
          priority={index === 0}
        />
      ))}
    </div>
  );
}

type FeedItem =
  | { type: "casting"; show: Show; uploadedAt: string }
  | { type: "event"; show: Show; event: RecentEvent };

const feedItemDate = (item: FeedItem) =>
  item.type === "casting" ? item.uploadedAt : item.event.createdAt;

async function RecentFeed() {
  const [recentUploads, recentEvents, shows] = await Promise.all([
    getRecentUploadedShows(FEED_LIMIT),
    getRecentEvents(FEED_LIMIT),
    getShows(),
  ]);
  const showById = await fillMissingShows(indexShowsById(shows), [
    ...recentUploads.map(({ showId }) => showId),
    ...recentEvents.map(({ showId }) => showId),
  ]);

  const castingItems = recentUploads
    .map(({ showId, uploadedAt }): FeedItem | null => {
      const show = showById.get(showId);
      return show ? { type: "casting", show, uploadedAt } : null;
    })
    .filter((item) => item !== null);

  const eventItems = recentEvents
    .map((event): FeedItem | null => {
      const show = showById.get(event.showId);
      return show ? { type: "event", show, event } : null;
    })
    .filter((item) => item !== null);

  const items = [...castingItems, ...eventItems]
    .sort((a, b) => feedItemDate(b).localeCompare(feedItemDate(a)))
    .slice(0, FEED_LIMIT);

  if (items.length === 0) return <EmptyFeed />;

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) =>
        item.type === "casting" ? (
          <RecentCastingCard
            key={`casting-${item.show.mt20id}`}
            show={item.show}
            uploadedAt={item.uploadedAt}
            priority={index === 0}
          />
        ) : (
          <RecentEventCard
            key={`event-${item.event.id}`}
            show={item.show}
            event={item.event}
            priority={index === 0}
          />
        ),
      )}
    </div>
  );
}

const EmptyFeed = () => (
  <div className="flex flex-col items-center gap-1 py-16 text-center">
    <div className="bg-sub mb-3 flex h-16 w-16 items-center justify-center rounded-full"></div>
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

const EmptyFavoriteFeed = () => (
  <div className="flex flex-col items-center gap-1 py-16 text-center">
    <div className="bg-sub mb-3 flex h-16 w-16 items-center justify-center rounded-full"></div>
    <p className="text-text font-medium">아직 애정배우가 없어요</p>
    <p className="text-text-muted mb-2 text-sm">
      배우를 검색해서 즐겨찾기해보세요
    </p>
    <Link
      href="/search"
      className="border-primary/30 text-primary hover:bg-primary mt-2 inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:text-white"
    >
      배우 검색하러 가기
    </Link>
  </div>
);
