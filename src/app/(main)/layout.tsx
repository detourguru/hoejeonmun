import Link from "next/link";
import { Suspense } from "react";

import { SearchBar } from "@/components/search/search-bar";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen sm:max-w-md mx-auto flex flex-col bg-sub">
      <header className="flex w-full flex-col gap-3 bg-point p-4 text-text">
        <h1 className="text-2xl font-bold">
          <Link href="/show">회전문 | Hoejeonmun</Link>
        </h1>

        <Suspense fallback={<div className="h-9" />}>
          <SearchBar />
        </Suspense>
      </header>

      <main className="w-full max-w-4xl p-4">{children}</main>

      <footer className="w-full bg-point p-4 text-text">
        <p>&copy; 2026 회전문 | Hoejeonmun. All rights reserved.</p>
      </footer>
    </div>
  );
}
