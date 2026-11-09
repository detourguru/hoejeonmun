import { createClient } from "@/lib/supabase/server";

/** Server Action에서 현재 요청의 인증 사용자와 Supabase 클라이언트를 조회한다. */
export async function getActionAuth() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return { supabase, userId: data?.claims?.sub ?? null };
}
