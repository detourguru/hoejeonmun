/**
 * #138: inspect first, then apply the exact confirmed pair.
 * node --env-file=.env.local --conditions=react-server --import tsx scripts/merge-user-show.ts [target-id] [--apply]
 */
import { createAdminClient } from "../src/lib/supabase/admin";

const sourceId = "local-29a1b6b5-6867-4ec3-ad1a-f5eb666ad9d0";

async function main() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY
  ) {
    throw new Error(
      "DB 연결 설정이 필요합니다. 인증 정보는 환경 설정에 등록하세요.",
    );
  }
  const admin = createAdminClient();
  const targetId = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const { data: source, error } = await admin
    .from("user_shows")
    .select("id, title, venue, period_start, period_end")
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!source) throw new Error("원본 공연이 없거나 이미 통합됐습니다.");
  const { data: candidates, error: candidateError } = await admin
    .from("user_shows")
    .select("id, title, venue, period_start, period_end")
    .or("title.ilike.%fated%,title.ilike.%페이티드%")
    .neq("id", sourceId);
  if (candidateError) throw candidateError;
  console.log({ source, candidates });
  if (!targetId) {
    if (process.argv.includes("--apply"))
      throw new Error("대상 ID를 지정하세요.");
    console.log("통합할 대상 ID를 확인한 뒤 target-id와 --apply로 실행하세요.");
    return;
  }
  const target = candidates?.find((candidate) => candidate.id === targetId);
  if (!target)
    throw new Error("FATED/페이티드 후보 중 확인된 대상 ID가 아닙니다.");
  if (
    target.period_start !== source.period_start ||
    target.period_end !== source.period_end ||
    target.venue !== source.venue
  ) {
    throw new Error("기간/공연장이 달라 동일 공연인지 추가 확인이 필요합니다.");
  }
  const { data: uploads, error: uploadError } = await admin
    .from("uploads")
    .select("id, show_id")
    .in("show_id", [sourceId, targetId]);
  if (uploadError) throw uploadError;
  console.log({ from: sourceId, to: targetId, uploads });
  if (!process.argv.includes("--apply")) {
    console.log("미리보기만 실행했습니다. --apply로 통합합니다.");
    return;
  }
  const { data: result, error: mergeError } = await admin.rpc(
    "merge_user_show",
    { p_from: sourceId, p_to: targetId },
  );
  if (mergeError) throw mergeError;
  console.log({ merged: result });
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
