import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

// 로그인 불가능한 회차 업로드 전용 시스템 계정
const SYSTEM_ACCOUNT_EMAIL = "system-upload@hoejeonmun.internal";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const existing = await findByEmail(supabase, SYSTEM_ACCOUNT_EMAIL);

  if (existing) {
    console.log("이미 존재하는 시스템 계정입니다.");
    console.log(`SYSTEM_UPLOAD_USER_ID=${existing.id}`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: SYSTEM_ACCOUNT_EMAIL,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: { system: true },
  });

  if (error || !data.user) {
    throw error ?? new Error("Failed to create system account");
  }

  console.log("시스템 계정을 새로 만들었습니다.");
  console.log(`SYSTEM_UPLOAD_USER_ID=${data.user.id}`);
}

async function findByEmail(supabase: SupabaseClient, email: string) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) throw error;

    const found = data.users.find((user) => user.email === email);

    if (found) return found;
    if (data.users.length < 200) return null;

    page++;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
