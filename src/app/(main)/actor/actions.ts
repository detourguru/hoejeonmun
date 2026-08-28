"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ToggleFavoriteResult =
  { ok: true; favorited: boolean } | { ok: false; message: string };

export async function toggleFavorite(
  actorId: number,
  favorited: boolean,
): Promise<ToggleFavoriteResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  // 캐스팅과 달리 개인 데이터라 서버 권한이 아니라 사용자 권한으로 쓴다
  const { error } = favorited
    ? await supabase
        .from("favorites")
        .delete()
        .eq("actor_id", actorId)
        .eq("user_id", userId)
    : await supabase
        .from("favorites")
        .insert({ actor_id: actorId, user_id: userId });

  if (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(`/actor/${actorId}`);
  revalidatePath("/mypage");

  return { ok: true, favorited: !favorited };
}
