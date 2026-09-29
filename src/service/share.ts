import "server-only";

import { randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 이미 있으면 그대로 재사용한다
export async function getOrCreateCalendarShareToken(
  userId: string,
): Promise<string> {
  const supabase = await createClient();

  const { data: existing, error: selectError } = await supabase
    .from("calendar_shares")
    .select("token")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing.token;

  const token = randomBytes(16).toString("hex");

  const { error: insertError } = await supabase
    .from("calendar_shares")
    .insert({ user_id: userId, token });

  if (insertError) throw insertError;

  return token;
}

// 공개 페이지는 세션이 없으므로 RLS를 우회하는 admin 클라이언트로 토큰 소유자를 찾는다
export async function getCalendarShareOwner(
  token: string,
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("calendar_shares")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;

  return data?.user_id ?? null;
}
