import { ChevronRight, Heart } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MyUploadsSection } from "@/components/mypage/my-uploads-section";
import { SignOutButton } from "@/components/mypage/sign-out-button";
import { createClient } from "@/lib/supabase/server";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "마이페이지 | 회전문",
};

// 비로그인 접근은 proxy에서 /login으로 보낸다
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) redirect("/login?next=/mypage");

  return (
    <div className="flex flex-col gap-6 pb-4">
      <h1 className="text-text text-xl font-bold">마이페이지</h1>

      <Link
        href="/mypage/favorite"
        className="border-border bg-surface hover:border-primary/30 flex items-center gap-3 rounded-xl border p-3 shadow-sm transition-all hover:shadow"
      >
        <span className="bg-point/40 flex size-9 shrink-0 items-center justify-center rounded-full">
          <Heart className="text-primary size-4" />
        </span>
        <span className="text-text flex-1 text-sm font-bold">애정배우</span>
        <ChevronRight className="text-text-muted size-4" />
      </Link>

      <MyUploadsSection userId={userId} />

      <SignOutButton />
    </div>
  );
}
