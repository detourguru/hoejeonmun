import { History } from "lucide-react";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/back-button";
import { RevertEditButton } from "@/components/show/revert-edit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { getIsAdmin } from "@/service/admin";
import { getCastingEdits } from "@/service/casting-edit";
import { getRequester } from "@/service/permission";
import { getShow } from "@/service/show";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "변경 이력 | 회전문",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

const SOURCE_LABEL = { notice: "공지", correction: "정정" } as const;

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function Page({ params }: Props) {
  const { id } = await params;
  const requester = await getRequester();

  if (!requester || !(await getIsAdmin(requester.supabase))) notFound();

  const [show, edits] = await Promise.all([getShow(id), getCastingEdits(id)]);

  if (!show) notFound();

  return (
    <div className="flex flex-col gap-4">
      <BackButton fallback={`/show/${id}/castings`} />

      <div className="flex flex-col gap-1">
        <h1 className="text-text text-lg font-bold">변경 이력</h1>
        <p className="text-text-muted text-xs">
          {show.prfnm}의 최근 변경 {edits.length}건
        </p>
      </div>

      {edits.length === 0 ? (
        <EmptyState icon={History} title="아직 변경 이력이 없어요" />
      ) : (
        <ul className="flex flex-col gap-2">
          {edits.map((edit) => (
            <li
              key={edit.id}
              className="border-border flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-text-muted text-[11px]">
                  {dateTimeFormatter.format(new Date(edit.createdAt))} ·{" "}
                  {SOURCE_LABEL[edit.source]}
                </p>
                <p className="text-text text-xs font-bold">{edit.label}</p>
                <p className="text-text text-xs break-words">{edit.detail}</p>
              </div>

              {edit.reverted ? (
                <span className="text-text-muted shrink-0 text-xs">되돌림</span>
              ) : (
                <RevertEditButton showId={id} editId={edit.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
