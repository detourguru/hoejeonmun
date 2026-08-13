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
        className="flex h-12 w-full items-center justify-center rounded-lg bg-[#FEE500] text-sm font-medium text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "카카오로 이동 중…" : "카카오로 시작하기"}
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
