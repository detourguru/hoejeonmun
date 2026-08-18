import Link from "next/link";

import { RecentCastingCard } from "@/components/show/recent-casting-card";
import { RecentEventCard } from "@/components/show/recent-event-card";
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
        <h1 className="font-extrabold tracking-tight flex items-center text-text">
          New!
        </h1>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {FEED_TAB.options.map(({ value, label }) => (
            <Link
              key={value}
              href={`/show?tab=${value}`}
              className={cn(
                "rounded-4xl border border-border px-3 py-1 text-xs transition-colors",
                value === tab ? "bg-primary text-white" : "text-text",
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        <Link
          href="/show/all"
          className="text-xs text-text-muted underline underline-offset-2"
        >
          필터로 찾기
        </Link>
      </div>
      {tab === "casting" ? <CastingFeed /> : <EventFeed />}
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
    <div className="flex-1">
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
    <div className="flex-1">
      {items.map(({ show, event }) => (
        <RecentEventCard key={event.id} show={show} event={event} />
      ))}
    </div>
  );
}

const EmptyFeed = () => (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <p className="text-sm text-text-muted">아직 아무것도 안 올라왔어요.</p>
    <Link
      href="/show/all"
      className="text-xs text-text underline underline-offset-2"
    >
      전체 공연 목록 둘러보기
    </Link>
  </div>
);
