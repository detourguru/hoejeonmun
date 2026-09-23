"use client";

import { Calendar, Home, User } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/show", label: "홈", icon: Home },
  { href: "/mypage/shows", label: "내 공연", icon: Calendar },
  { href: "/mypage", label: "마이페이지", icon: User },
];

const LAST_PATHS_KEY = "footer-nav-last-paths";

// 경로가 긴 쪽부터 (그래야 더 하위페이지부터 조회가능)
const SECTIONS = TABS.map(({ href }) => href).sort(
  (a, b) => b.length - a.length,
);

const DEFAULT_SECTION = "/show";

const sectionOf = (pathname: string) =>
  SECTIONS.find(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  ) ?? DEFAULT_SECTION;

type LastPaths = Record<string, string>;

const EMPTY: LastPaths = {};

const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cached: LastPaths = EMPTY;

const readLastPaths = (): LastPaths => {
  let raw: string | null = null;

  try {
    raw = sessionStorage.getItem(LAST_PATHS_KEY);
  } catch {
    // 사생활 보호 모드 등 sessionStorage를 못 쓰는 환경에서는 기억하지 않는다
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;

    try {
      cached = raw ? JSON.parse(raw) : EMPTY;
    } catch {
      cached = EMPTY;
    }
  }

  return cached;
};

const getServerSnapshot = () => EMPTY;

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const rememberPath = (section: string, path: string) => {
  const next = { ...readLastPaths(), [section]: path };

  try {
    sessionStorage.setItem(LAST_PATHS_KEY, JSON.stringify(next));
  } catch {
    return;
  }

  for (const listener of listeners) listener();
};

export const FooterNav = () => (
  <Suspense fallback={<NavBar lastPaths={EMPTY} />}>
    <NavBarWithHistory />
  </Suspense>
);

const NavBarWithHistory = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPaths = useSyncExternalStore(
    subscribe,
    readLastPaths,
    getServerSnapshot,
  );

  const query = searchParams.toString();

  useEffect(() => {
    rememberPath(
      sectionOf(pathname),
      query ? `${pathname}?${query}` : pathname,
    );
  }, [pathname, query]);

  return <NavBar lastPaths={lastPaths} />;
};

const NavBar = ({ lastPaths }: { lastPaths: LastPaths }) => {
  const pathname = usePathname();
  const section = sectionOf(pathname);

  return (
    <nav className="border-border bg-surface flex w-full items-center justify-around border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        // 보고 있는 메뉴를 다시 누를 때는 그 메뉴의 첫 화면으로 돌아간다
        const target = href === section ? href : (lastPaths[href] ?? href);

        return (
          <Link
            key={href}
            href={target}
            className={cn(
              "flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors",
              isActive
                ? "bg-point/40 text-primary"
                : "text-text-muted hover:text-text",
            )}
          >
            <TabContent icon={Icon} label={label} isActive={isActive} />
          </Link>
        );
      })}
    </nav>
  );
};

const TabContent = ({
  icon: Icon,
  label,
  isActive,
}: {
  icon: (typeof TABS)[number]["icon"];
  label: string;
  isActive: boolean;
}) => {
  const { pending } = useLinkStatus();

  return (
    <span
      className={cn(
        "flex flex-col items-center gap-1 transition-opacity",
        pending && "opacity-50",
      )}
    >
      <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
      {label}
    </span>
  );
};
