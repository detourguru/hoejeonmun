import { notFound, redirect } from "next/navigation";

import { BackButton } from "@/components/back-button";
import { RegisterShowForm } from "@/components/show/register-show-form";
import { createClient } from "@/lib/supabase/server";
import { getUserShowForEdit, isUserShowId } from "@/service/user-show";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공연 수정 | 회전문",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;

  if (!isUserShowId(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/show/${id}/edit`)}`);
  }

  const show = await getUserShowForEdit(id, userId);

  if (!show) notFound();

  return (
    <div className="flex flex-col gap-4">
      <BackButton />

      <div className="flex flex-col gap-1">
        <h1 className="text-text text-lg font-bold">공연 수정</h1>
        <p className="text-text-muted text-xs">
          직접 등록한 공연의 정보를 고칠 수 있어요.
        </p>
      </div>

      <RegisterShowForm show={show} />
    </div>
  );
}
