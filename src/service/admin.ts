import { createClient } from "@/lib/supabase/server";

// admins는 RLS로 본인 행만 보이므로 결과가 있으면 요청자가 관리자다
export async function getIsAdmin(
  supabase: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .maybeSingle();

  if (error) throw error;

  return !!data;
}
