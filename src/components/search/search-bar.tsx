"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

const HIDE_ON_PATHS = ["/show/all"];

const RECENT_SEARCHES_KEY = "recentSearches";
const MAX_RECENT_SEARCHES = 8;

const readRecentSearches = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);

    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const writeRecentSearches = (searches: string[]) => {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch {
    // 사생활 보호 모드 등 localStorage를 못 쓰는 환경인경우 검색기록 지원하지 않음
  }
};

export const SearchBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const focusGuardPushedRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (!focusGuardPushedRef.current) return;

      focusGuardPushedRef.current = false;
      (document.activeElement as HTMLElement | null)?.blur();
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const pushFocusGuard = () => {
    if (focusGuardPushedRef.current) return;

    focusGuardPushedRef.current = true;
    history.pushState({ searchFocusGuard: true }, "");
  };

  const clearFocusGuard = () => {
    if (!focusGuardPushedRef.current) return;

    focusGuardPushedRef.current = false;
    history.back();
  };

  if (searchParams !== prevSearchParams) {
    setPrevSearchParams(searchParams);
    setKeyword(searchParams.get("q") ?? "");
  }

  if (HIDE_ON_PATHS.includes(pathname)) return null;

  const search = (raw: string) => {
    const trimmed = raw.trim();

    if (!trimmed) return;

    const next = [
      trimmed,
      ...recentSearches.filter((item) => item !== trimmed),
    ].slice(0, MAX_RECENT_SEARCHES);

    setRecentSearches(next);
    writeRecentSearches(next);
    setShowRecent(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const removeRecentSearch = (target: string) => {
    const next = recentSearches.filter((item) => item !== target);

    setRecentSearches(next);
    writeRecentSearches(next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    search(keyword);
  };

  return (
    <div
      className="relative flex flex-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setShowRecent(false);
          clearFocusGuard();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="search"
        className="bg-sub focus-within:ring-primary/30 flex flex-1 items-center gap-2.5 rounded-full px-4 py-2.5 transition-shadow focus-within:ring-2"
      >
        <Search className="text-text-muted size-4 shrink-0" />

        <Input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onFocus={() => {
            setShowRecent(true);
            pushFocusGuard();
          }}
          placeholder="공연 또는 배우 검색"
          aria-label="공연 또는 배우 검색"
          className="h-auto min-w-0 rounded-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 md:text-sm"
        />
      </form>

      {showRecent && recentSearches.length > 0 && (
        <ul className="bg-popover text-popover-foreground ring-foreground/10 absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 flex flex-col overflow-hidden rounded-lg shadow-md ring-1">
          {recentSearches.map((item) => (
            <li key={item} className="flex items-center">
              <button
                type="button"
                className="hover:bg-sub flex-1 truncate px-4 py-2.5 text-left text-sm"
                onClick={() => search(item)}
              >
                {item}
              </button>
              <button
                type="button"
                aria-label={`${item} 최근 검색어 삭제`}
                className="text-text-muted hover:text-text px-3 py-2.5"
                onClick={() => removeRecentSearch(item)}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
