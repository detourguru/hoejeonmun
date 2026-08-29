"use server";

import { sendBugReportEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";

export type BugReportResult = { ok: true } | { ok: false; message: string };

const RESUBMIT_COOLDOWN_MS = 30_000;

export async function submitBugReport(
  message: string,
  url: string,
  userAgent: string,
): Promise<BugReportResult> {
  const trimmed = message.trim();

  if (!trimmed) return { ok: false, message: "내용을 입력해 주세요." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const { data: recent } = await supabase
    .from("bug_reports")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    recent &&
    Date.now() - new Date(recent.created_at).getTime() < RESUBMIT_COOLDOWN_MS
  ) {
    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  const { error } = await supabase.from("bug_reports").insert({
    user_id: userId,
    message: trimmed,
    url,
    user_agent: userAgent,
    commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });

  if (error) {
    console.error(error);
    return { ok: false, message: "제출하지 못했어요. 다시 시도해 주세요." };
  }

  await sendBugReportEmail({
    message: trimmed,
    url,
    userAgent,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  });

  return { ok: true };
}
