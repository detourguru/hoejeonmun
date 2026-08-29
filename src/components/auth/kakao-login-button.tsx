"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export const KakaoLoginButton = ({ next }: { next: string }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setPending(true);
    setError(null);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError("로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] text-sm font-medium text-[rgba(0,0,0,0.85)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#000000"
            d="M9 1.5C4.582 1.5 1 4.302 1 7.758c0 2.235 1.488 4.194 3.747 5.314-.166.587-.6 2.128-.687 2.459-.108.41.15.404.316.294.13-.087 2.07-1.404 2.91-1.975.553.082 1.124.124 1.714.124 4.418 0 8-2.802 8-6.258S13.418 1.5 9 1.5z"
          />
        </svg>
        {pending ? "카카오톡에서 로그인 중..." : "카카오톡으로 시작하기"}
      </button>

      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
};
