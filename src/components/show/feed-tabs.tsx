"use client";

import Link, { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";
import {
  DEFAULT_SHOW_FEED_TAB,
  SHOW_FEED_TAB,
  type ShowFeedTab,
} from "@/type/show";

// 기본 탭은 처음 연 /show, 하단 메뉴의 홈과 같은 주소여야 클라이언트 캐시를 함께 쓴다
const feedHref = (tab: ShowFeedTab) =>
  tab === DEFAULT_SHOW_FEED_TAB ? "/show" : `/show?tab=${tab}`;

export const FeedTabs = ({ current }: { current: ShowFeedTab }) => (
  <div className="bg-sub flex gap-0.5 rounded-xl p-0.5">
    {SHOW_FEED_TAB.options.map(({ value, label }) => (
      <Link
        key={value}
        href={feedHref(value)}
        // 다른 탭은 미리 받아 두어 처음 눌러도 바로 바뀌게 한다
        prefetch={value === current ? null : true}
        className={cn(
          "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
          value === current
            ? "bg-surface text-primary shadow-sm"
            : "text-text-muted hover:text-text",
        )}
      >
        <TabLabel label={label} />
      </Link>
    ))}
  </div>
);

const TabLabel = ({ label }: { label: string }) => {
  const { pending } = useLinkStatus();

  return (
    <span className={cn("transition-opacity", pending && "opacity-50")}>
      {label}
    </span>
  );
};
