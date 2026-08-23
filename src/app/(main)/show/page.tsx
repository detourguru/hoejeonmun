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
      <div className="-mx-4 -mt-4 bg-primary px-4 pt-5 pb-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-point/70">
          Latest Updates
        </p>
        <h1 className="text-2xl leading-snug font-bold text-white">
          새로 올라왔어요
        </h1>
        <p className="mt-1 text-sm text-white/60">
          다른 사용자들이 올린 캐스팅보드와 이벤트를 확인해요
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-0.5 rounded-xl bg-sub p-0.5">
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
          className="group flex items-center gap-1 text-xs font-medium text-primary"
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

      <KopisNotice />
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
    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-sub">
      <span className="font-serif text-2xl text-text-muted">幕</span>
    </div>
    <p className="font-medium text-text">아직 아무것도 올라오지 않았어요</p>
    <p className="mb-2 text-sm text-text-muted">첫 번째 제보자가 되어볼까요?</p>
    <Link
      href="/show/all"
      className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/30 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
    >
      전체 공연 목록 둘러보기
    </Link>
  </div>
);

const KopisNotice = () => (
  <div className="flex items-start gap-2 rounded-xl border border-border bg-sub/60 p-3">
    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    </div>
    <p className="text-xs leading-relaxed text-text-muted">
      캐스팅 및 이벤트 정보는 사용자 제보 기반이에요. 제보 시점 이후 변경 사항은
      반영되지 않을 수 있어요.
    </p>
  </div>
);
