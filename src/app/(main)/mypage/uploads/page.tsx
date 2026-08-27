import { redirect } from "next/navigation";

import { BackButton } from "@/components/back-button";
import { UploadList } from "@/components/mypage/upload-list";
import { createClient } from "@/lib/supabase/server";
import { getMyUploads } from "@/service/mypage";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내가 올린 캐스팅보드 | 회전문",
};

// 비로그인 접근은 proxy에서 /login으로 보낸다
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) redirect("/login?next=/mypage/uploads");

  const uploads = await getMyUploads(userId);

  return (
    <div className="flex flex-col gap-4">
      <BackButton fallback="/mypage" />
      <h1 className="text-text text-xl font-bold">내가 올린 캐스팅보드</h1>

      <UploadList uploads={uploads} />
    </div>
  );
}
