import { redirect } from "next/navigation";

import { InstallGuideButton } from "@/components/install-guide-button";
import { DonateButton } from "@/components/mypage/donate-button";
import { FavoriteActorsPreview } from "@/components/mypage/favorite-actors-preview";
import { MyUploadsSection } from "@/components/mypage/my-uploads-section";
import { ProfileHero } from "@/components/mypage/profile-hero";
import { SignOutButton } from "@/components/mypage/sign-out-button";
import { createClient } from "@/lib/supabase/server";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "마이페이지 | 회전문",
};

type KakaoUserMetadata = {
  name?: string;
  full_name?: string;
  preferred_username?: string;
};

// 비로그인 접근은 proxy에서 /login으로 보낸다
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) redirect("/login?next=/mypage");

  const metadata = data?.claims?.user_metadata as KakaoUserMetadata | undefined;
  const displayName =
    metadata?.name ?? metadata?.full_name ?? metadata?.preferred_username ?? null;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <h1 className="sr-only">마이페이지</h1>

      <ProfileHero userId={userId} displayName={displayName} />

      <FavoriteActorsPreview />

      <MyUploadsSection userId={userId} />

      <div className="border-border bg-surface divide-border overflow-hidden rounded-xl border divide-y">
        <DonateButton />
        <InstallGuideButton />
        <SignOutButton />
      </div>
    </div>
  );
}
