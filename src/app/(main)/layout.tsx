import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { SearchBar } from "@/components/search/search-bar";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-sub mx-auto flex min-h-screen flex-col sm:max-w-md">
      <header className="bg-point text-text flex w-full flex-col gap-3 p-4">
        <h1 className="text-2xl font-bold">
          <Link className="flex items-center gap-1" href="/show">
            <Image
              priority
              width={48}
              height={48}
              src="/logo.png"
              className="size-12"
              alt="회전문 로고"
            />
            회전문 | Hoejeonmun
          </Link>
        </h1>

        <Suspense fallback={<div className="h-9" />}>
          <SearchBar />
        </Suspense>
      </header>

      <main className="flex w-full max-w-4xl flex-1 flex-col p-4">
        {children}
      </main>

      <footer className="bg-point text-text w-full p-4">
        <p>&copy; 2026 회전문 | Hoejeonmun. All rights reserved.</p>
      </footer>
    </div>
  );
}
