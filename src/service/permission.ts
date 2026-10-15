import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/service/admin";

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
