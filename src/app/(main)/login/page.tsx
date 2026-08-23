import { redirect } from "next/navigation";

import { KakaoLoginButton } from "@/components/auth/kakao-login-button";
import { createClient } from "@/lib/supabase/server";

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
    <section className="flex flex-col gap-8 py-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-text text-xl font-bold">로그인</h2>
        <p className="text-text-muted text-sm">
          캐스팅보드 제보와 애정배우 저장에만 사용해요.
        </p>
      </div>

      <KakaoLoginButton next={next} />

      {error && (
        <p className="text-destructive text-xs">
          {ERROR_MESSAGE[error] ?? ERROR_MESSAGE.failed}
        </p>
      )}
    </section>
  );
}
