"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";

export const SearchBar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = keyword.trim();

    if (!trimmed) return;

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} role="search">
      <Input
        type="search"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="공연 또는 배우 검색"
        aria-label="공연 또는 배우 검색"
        className="bg-surface"
      />
    </form>
  );
};
