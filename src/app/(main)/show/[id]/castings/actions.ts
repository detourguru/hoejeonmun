"use server";

import { createClient } from "@/lib/supabase/server";

export type SetEventUrlResult =
  | { ok: true; url: string | null }
  | { ok: false; message: string };

const URL_PATTERN = /^https?:\/\//;

export async function setEventUrl(
  eventId: number,
  rawUrl: string,
): Promise<SetEventUrlResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) return { ok: false, message: "로그인이 필요해요." };

  const url = rawUrl.trim();

  if (url && !URL_PATTERN.test(url)) {
    return {
      ok: false,
      message: "http(s):// 로 시작하는 링크만 등록할 수 있어요.",
    };
  }

  // 캐스팅/이벤트와 동일하게 누구나 즉시 반영 / 오남용은 신고 기반으로 방어
  const { error } = await supabase
    .from("events")
    .update({ url: url || null })
    .eq("id", eventId);

  if (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  return { ok: true, url: url || null };
}
