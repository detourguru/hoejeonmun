"use server";

import { sendBugReportEmail } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BUG_REPORT_IMAGE_BUCKET } from "@/type/bug-report";
import { SIGNED_URL_TTL_SECONDS } from "@/type/casting";

export type BugReportResult = { ok: true } | { ok: false; message: string };

const RESUBMIT_COOLDOWN_MS = 30_000;

async function getSignedImageUrls(paths: string[]) {
  if (paths.length === 0) return [];

  const { data, error } = await createAdminClient()
    .storage.from(BUG_REPORT_IMAGE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error(error);
    return [];
  }

  return data.flatMap((entry) => (entry.signedUrl ? [entry.signedUrl] : []));
}

export async function submitBugReport(
  message: string,
  url: string,
  userAgent: string,
  imagePaths: string[] = [],
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
    commit_sha: process.env.APP_COMMIT_SHA || null,
    image_paths: imagePaths,
  });

  if (error) {
    console.error(error);
    return { ok: false, message: "제출하지 못했어요. 다시 시도해 주세요." };
  }

  await sendBugReportEmail({
    userId,
    message: trimmed,
    url,
    userAgent,
    commitSha: process.env.APP_COMMIT_SHA || null,
    imageUrls: await getSignedImageUrls(imagePaths),
  });

  return { ok: true };
}
