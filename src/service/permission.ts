import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/service/admin";

export const CORRECTION_LIMIT_PER_HOUR = 50;

export type Requester = {
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

export async function getRequester(): Promise<Requester | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  return userId ? { userId, supabase } : null;
}

export async function canManageUpload(
  requester: Requester,
  ownerId: string,
): Promise<boolean> {
  if (requester.userId === ownerId) return true;

  return getIsAdmin(requester.supabase);
}

export async function isCorrectionLimited(
  admin: ReturnType<typeof createAdminClient>,
  requester: Requester,
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from("casting_edits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", requester.userId)
    .eq("source", "correction")
    .gte("created_at", since);

  if (error) throw error;
  if (count === null) throw new Error("정정 횟수를 확인하지 못했어요.");

  if (count < CORRECTION_LIMIT_PER_HOUR) return false;

  return !(await getIsAdmin(requester.supabase));
}
