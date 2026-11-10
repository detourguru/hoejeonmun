import { notFound } from "next/navigation";

import {
  retryModerationCleanup,
  unbanUploadUser,
} from "@/app/(main)/show/[id]/moderation-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActionAuth } from "@/service/action-auth";
import { getIsAdmin } from "@/service/admin";

export const metadata = {
  title: "업로드 운영 이력",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const { supabase, userId } = await getActionAuth();
  if (!userId || !(await getIsAdmin(supabase))) notFound();
  const admin = createAdminClient();
  const [logs, bans, cleanup] = await Promise.all([
    admin
      .from("upload_moderation_log")
      .select("*")
      .order("id", { ascending: false })
      .limit(100),
    admin.from("upload_bans").select("*"),
    admin
      .from("upload_storage_cleanup")
      .select("id, moderation_id, attempts, last_error"),
  ]);
  if (logs.error || bans.error || cleanup.error)
    throw new Error("운영 이력을 조회하지 못했어요.");
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-lg font-bold">업로드 운영 이력</h1>
      <h2>업로드 차단 계정</h2>
      {(bans.data ?? []).map((ban) => (
        <form
          key={ban.user_id}
          className="border-border rounded border p-3"
          action={async (formData: FormData) => {
            "use server";
            await unbanUploadUser(
              ban.user_id,
              String(formData.get("reason") ?? ""),
            );
          }}
        >
          <p className="break-all">{ban.user_id}</p>
          <p>{ban.reason}</p>
          <input
            name="reason"
            aria-label="차단 해제 사유"
            placeholder="차단 해제 사유"
            required
            maxLength={1000}
            className="border-border rounded border p-2"
          />
          <button type="submit" className="ml-2 underline">
            차단 해제
          </button>
        </form>
      ))}
      <h2>이미지 정리 대기: {cleanup.data?.length ?? 0}건</h2>
      <form
        action={async () => {
          "use server";
          await retryModerationCleanup();
        }}
      >
        <button className="underline">실패한 이미지 정리 다시 실행</button>
      </form>
      {(cleanup.data ?? []).map((row) => (
        <p key={row.id}>
          조치 #{row.moderation_id} · 재시도 {row.attempts}회 · {row.last_error}
        </p>
      ))}
      <h2>최근 조치 100건</h2>
      {(logs.data ?? []).map((log) => (
        <article
          key={log.id}
          className="border-border rounded border p-3 text-xs"
        >
          <p>
            #{log.id} {log.created_at} ·{" "}
            {log.action === "unban" ? "차단 해제" : "삭제"}
          </p>
          <p className="break-all">
            운영자: {log.moderator_id} / 대상: {log.target_user_id}
          </p>
          <p>
            대상 업로드: {log.target_upload_id} · 삭제:{" "}
            {(log.upload_ids as number[]).join(", ")} · 전체{" "}
            {String(log.all_uploads)} · 차단 {String(log.banned)}
          </p>
          <p className="whitespace-pre-wrap">{log.reason}</p>
        </article>
      ))}
    </div>
  );
}
