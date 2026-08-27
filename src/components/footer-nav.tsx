"use client";

import { Calendar, Home, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/show", label: "홈", icon: Home },
  { href: "/mypage/shows", label: "내 공연", icon: Calendar },
  { href: "/mypage", label: "마이페이지", icon: User },
];

export const FooterNav = () => {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav className="border-border bg-surface flex w-full items-center justify-around border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors",
              isActive
                ? "bg-point/40 text-primary"
                : "text-text-muted hover:text-text",
            )}
          >
            <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
};
