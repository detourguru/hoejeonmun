import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * RLS를 우회하는 서버 전용 클라이언트
 * 브라우저 번들에 절대 들어가면 안 되므로 서버 코드에서만 import 해야한다
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
