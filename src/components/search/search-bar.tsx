"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";

// /show/all은 자체 목록 검색(FilterBar)이 있어 전역 검색바와 겹쳐 보이므로 숨긴다
const HIDE_ON_PATHS = ["/show/all"];

export const SearchBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");

  if (HIDE_ON_PATHS.includes(pathname)) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = keyword.trim();

    if (!trimmed) return;

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="bg-sub focus-within:ring-primary/30 flex flex-1 items-center gap-2.5 rounded-full px-4 py-2.5 transition-shadow focus-within:ring-2"
    >
      <Search className="text-text-muted size-4 shrink-0" />

      <Input
        type="search"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="공연 또는 배우 검색"
        aria-label="공연 또는 배우 검색"
        className="h-auto min-w-0 rounded-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      />
    </form>
  );
};
