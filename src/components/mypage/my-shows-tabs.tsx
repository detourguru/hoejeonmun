"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  DEFAULT_MY_SHOWS_TAB,
  MY_SHOWS_TAB,
  type MyShowsTab,
} from "@/type/casting";

// 탭을 옮겨도 보던 달과 보기 방식(달력/목록)은 그대로 이어간다
const KEPT_PARAMS = ["month", "view"];

export const MyShowsTabs = ({ current }: { current: MyShowsTab }) => {
  const searchParams = useSearchParams();

  const hrefOf = (tab: MyShowsTab) => {
    const params = new URLSearchParams();

    for (const key of KEPT_PARAMS) {
      const value = searchParams.get(key);

      if (value) params.set(key, value);
    }

    if (tab !== DEFAULT_MY_SHOWS_TAB) params.set("tab", tab);

    const query = params.toString();

    return query ? `/mypage/shows?${query}` : "/mypage/shows";
  };

  return (
    <div className="bg-sub flex w-fit gap-0.5 rounded-xl p-0.5">
      {MY_SHOWS_TAB.options.map(({ value, label }) => (
        <Link
          key={value}
          href={hrefOf(value)}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
            value === current
              ? "bg-surface text-primary shadow-sm"
              : "text-text-muted hover:text-text",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
};
