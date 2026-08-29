import Image from "next/image";
import { redirect } from "next/navigation";

import { KakaoLoginButton } from "@/components/auth/kakao-login-button";
import { createClient } from "@/lib/supabase/server";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: true },
};

const ERROR_MESSAGE: Record<string, string> = {
  cancelled: "로그인을 취소했어요.",
  failed: "로그인에 실패했어요. 다시 시도해 주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/show", error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) redirect(next);

  return (
    <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <span className="bg-point/30 text-primary rounded-full px-3 py-1 text-[11px] font-bold tracking-wide">
        BETA
      </span>

      <div className="flex flex-col items-center gap-2">
        <div className="relative flex items-center justify-center">
          <div className="animation-duration-[3s] bg-point/40 absolute h-44 w-44 animate-pulse rounded-full blur-2xl" />
          <Image
            priority
            width={80}
            height={80}
            src="/logo.png"
            alt="회전문 로고"
            className="relative"
          />
        </div>

        <span className="font-heading text-primary text-lg font-bold">
          회전문
        </span>
      </div>

      <h1 className="text-text font-heading text-2xl leading-snug font-bold text-balance">
        보고 싶은 <span className="text-primary">배우의 회차</span>,
        <br />
        한눈에 찾아요
      </h1>

      <div className="bg-point h-0.5 w-10 rounded-full" />

      <p className="text-text-muted max-w-64 text-sm leading-relaxed">
        공연별 캐스팅과 이벤트 정보를
        <br />
        한곳에서 확인해보세요
      </p>

      <div className="border-border bg-surface w-full max-w-xs rounded-xl border p-5 shadow-sm">
        <KakaoLoginButton next={next} />

        {error && (
          <p className="text-destructive mt-3 text-xs">
            {ERROR_MESSAGE[error] ?? ERROR_MESSAGE.failed}
          </p>
        )}
      </div>
    </main>
  );
}
