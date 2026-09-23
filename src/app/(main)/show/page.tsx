import { CalendarOff, Heart, Inbox } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { FavoriteActorShowCard } from "@/components/show/favorite-actor-show-card";
import { FeedTabs } from "@/components/show/feed-tabs";
import { RecentCastingCard } from "@/components/show/recent-casting-card";
import { RecentEventCard } from "@/components/show/recent-event-card";
import { TodayShowList } from "@/components/show/today-show-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingGhost } from "@/components/ui/loading-ghost";
import {
  formatShortDate,
  getNowTime,
  getToday,
  getWeekday,
  toInputDate,
  toMonth,
} from "@/lib/date";
import { getShowsWithFavoritedActors } from "@/service/actor";
import {
  getRecentEvents,
  getRecentUploadedShows,
  getTodayShowSlots,
  RecentEvent,
} from "@/service/casting";
import { withPosterThumbnails } from "@/service/poster-thumbnail";
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
  const tab = SHOW_FEED_TAB.isCode(rawTab) ? rawTab : DEFAULT_SHOW_FEED_TAB;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-primary/60 text-[11px] font-bold tracking-widest uppercase">
          Discover
        </p>
        <h2 className="text-text text-lg font-bold">둘러보기</h2>
      </div>

      <div className="flex items-center justify-between gap-2">
        <FeedTabs current={tab} />

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
        {tab === "today" ? (
          <TodayFeed />
        ) : tab === "favorite" ? (
          <FavoriteActorFeed />
        ) : (
          <RecentFeed />
        )}
      </Suspense>
    </div>
  );
}

async function applyPosterThumbnails<T extends { show: Show }>(
  items: T[],
): Promise<T[]> {
  const shows = await withPosterThumbnails(items.map(({ show }) => show));

  return items.map((item, index) => ({ ...item, show: shows[index] }));
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

async function TodayFeed() {
  const slots = await getTodayShowSlots();

  if (slots.length === 0) return <EmptyTodayFeed />;

  const today = toInputDate(getToday());
  const month = toMonth(getToday());

  return (
    <div className="flex flex-col gap-2">
      <p className="text-text-muted -mt-1 text-xs">
        {formatShortDate(`${today}T00:00:00Z`)} ({getWeekday(today)})
      </p>

      <TodayShowList
        slots={slots}
        now={getNowTime()}
        today={today}
        month={month}
      />
    </div>
  );
}

async function FavoriteActorFeed() {
  const favoritedShows = await getShowsWithFavoritedActors();

  if (favoritedShows.length === 0) return <EmptyFavoriteFeed />;

  const showById = await fillMissingShows(
    indexShowsById(await getShows()),
    favoritedShows.map(({ showId }) => showId),
  );

  const items = await applyPosterThumbnails(
    favoritedShows
      .map((favorited) => {
        const show = showById.get(favorited.showId);
        return show ? { ...favorited, show } : null;
      })
      .filter((item) => item !== null),
  );

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

  const items = await applyPosterThumbnails(
    [...castingItems, ...eventItems]
      .sort((a, b) => feedItemDate(b).localeCompare(feedItemDate(a)))
      .slice(0, FEED_LIMIT),
  );

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
  <EmptyState
    icon={Inbox}
    title="아직 올라온 소식이 없어요"
    description="공연을 골라 캐스팅보드를 올리면 이곳에 바로 뜨고, 다른 관객도 볼 수 있어요."
    action={
      <Button size="lg" shape="pill" render={<Link href="/show/all" />}>
        공연 목록에서 고르기
      </Button>
    }
  />
);

const EmptyTodayFeed = () => (
  <EmptyState
    icon={CalendarOff}
    title="오늘 등록된 회차가 없어요"
    description="공연을 골라 오늘 회차의 캐스팅보드를 올려주세요."
    action={
      <Button size="lg" shape="pill" render={<Link href="/show/all" />}>
        공연 목록에서 고르기
      </Button>
    }
  />
);

const EmptyFavoriteFeed = () => (
  <EmptyState
    icon={Heart}
    title="아직 애정배우가 없어요"
    description="배우를 검색해 애정배우로 담아두면 그 배우가 나오는 공연만 모아 볼 수 있어요."
    action={
      <Button size="lg" shape="pill" render={<Link href="/search" />}>
        배우 검색하러 가기
      </Button>
    }
  />
);
