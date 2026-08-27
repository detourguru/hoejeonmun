import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { FooterNav } from "@/components/footer-nav";
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

      <main className="flex w-full max-w-4xl flex-1 flex-col p-4 pb-24">
        {children}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full sm:max-w-md">
        <FooterNav />
      </footer>
    </div>
  );
}
