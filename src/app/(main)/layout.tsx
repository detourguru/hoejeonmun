import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { BugReportButton } from "@/components/bug-report-button";
import { FooterNav } from "@/components/footer-nav";
import { SearchBar } from "@/components/search/search-bar";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-sub mx-auto flex min-h-screen flex-col sm:max-w-md">
      <header className="bg-point border-border flex w-full items-center gap-3 border-b p-4">
        <h1 className="text-lg font-bold">
          <Link className="flex items-center gap-2" href="/show">
            <Image
              priority
              width={28}
              height={28}
              src="/logo.png"
              className="size-7"
              alt="회전문 로고"
            />
            <span className="font-heading text-primary">회전문</span>
          </Link>
        </h1>

        <Suspense fallback={<div className="h-10" />}>
          <SearchBar />
        </Suspense>
      </header>

      <main className="flex w-full max-w-4xl flex-1 flex-col p-4 pb-24">
        {children}
      </main>

      <Suspense fallback={null}>
        <BugReportButton />
      </Suspense>

      <footer className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full sm:max-w-md">
        <FooterNav />
      </footer>
    </div>
  );
}
