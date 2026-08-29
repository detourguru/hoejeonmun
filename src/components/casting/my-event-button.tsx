"use client";

import { Bookmark } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleMyEventGroup } from "@/app/(main)/mypage/actions";
import { cn } from "@/lib/utils";

export const MyEventButton = ({
  groupId,
  bookmarked: initial,
  date,
}: {
  groupId: number;
  bookmarked: boolean;
  date: string;
}) => {
  const router = useRouter();
  const currentPage = usePathname();

  const [bookmarked, setBookmarked] = useState(initial);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    // 낙관적 update
    const next = !bookmarked;

    setBookmarked(next);

    startTransition(async () => {
      const result = await toggleMyEventGroup(groupId, bookmarked, date);

      if (!result.ok) {
        setBookmarked(bookmarked);

        if (result.message === "로그인이 필요해요.") {
          router.push(`/login?next=${encodeURIComponent(currentPage)}`);
        }
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "내 공연에서 지우기" : "내 공연 담기"}
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-4xl px-2 py-1 text-[11px] transition-colors disabled:opacity-60",
        bookmarked ? "text-primary" : "text-text-muted hover:text-primary",
      )}
    >
      <Bookmark
        className="size-3.5"
        fill={bookmarked ? "currentColor" : "none"}
      />
    </button>
  );
};
