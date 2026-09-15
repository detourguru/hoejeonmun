"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitManualCasting } from "@/app/(main)/show/[id]/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { SlotExceptionEditor } from "@/components/show/slot-exception-editor";
import { Input } from "@/components/ui/input";
import { useLoginRedirect } from "@/hook/useLoginRedirect";
import type { ManualCastingRole } from "@/service/manual-casting";
import { EventSlotException } from "@/type/casting";

const DEFAULT_CASTING: ManualCastingRole[] = [{ role: "전체", actor: "" }];

export const ManualCastingButton = ({
  showId,
  isLoggedIn,
}: {
  showId: string;
  isLoggedIn: boolean;
}) => {
  const router = useRouter();
  const loginRedirect = useLoginRedirect(`/show/${showId}/castings`);

  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<EventSlotException[]>([]);
  const [casting, setCasting] = useState<ManualCastingRole[]>(DEFAULT_CASTING);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openSheet = () => {
    if (!isLoggedIn) {
      loginRedirect("로그인이 필요해요.");
      return;
    }

    setSlots([]);
    setCasting(DEFAULT_CASTING);
    setError(null);
    setOpen(true);
  };

  const updateCasting = (index: number, next: Partial<ManualCastingRole>) =>
    setCasting((current) =>
      current.map((row, at) => (at === index ? { ...row, ...next } : row)),
    );

  const addCastingRow = () =>
    setCasting((current) => [...current, { role: "", actor: "" }]);

  const removeCastingRow = (index: number) =>
    setCasting((current) => current.filter((_, at) => at !== index));

  const handleSubmit = () => {
    setError(null);

    if (slots.length === 0) {
      setError("회차(날짜/시간)를 입력해 주세요.");
      return;
    }

    if (!casting.some(({ role, actor }) => role.trim() && actor.trim())) {
      setError("배역/배우를 최소 1개 입력해 주세요.");
      return;
    }

    startTransition(async () => {
      const result = await submitManualCasting(showId, slots, casting);

      if (!result.ok) {
        if (loginRedirect(result.message)) return;

        setError(result.message);
        return;
      }

      setOpen(false);
      toast.success(`${result.slotCount}개 회차를 등록했어요.`);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="border-border text-text inline-flex w-fit rounded-lg border px-3 py-1 text-xs"
      >
        일정/캐스팅 직접 등록
      </button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="일정/캐스팅 직접 등록"
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted text-xs">
            원캐스트라 캐스팅보드 이미지가 따로 없는 공연은 배역/배우와 회차를
            직접 입력해서 등록할 수 있어요. 배역명은 몰라도
            &ldquo;전체&rdquo;처럼 대략 적고 배우명만 채워도 돼요.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="text-text-muted text-xs font-bold">배역/배우</span>
            <ul className="flex flex-col gap-1">
              {casting.map((row, index) => (
                <li key={index} className="flex items-center gap-1">
                  <Input
                    value={row.role}
                    onChange={({ target }) =>
                      updateCasting(index, { role: target.value })
                    }
                    placeholder="배역 (예: 전체)"
                    aria-label="배역"
                    className="w-24 shrink-0"
                    disabled={pending}
                  />
                  <Input
                    value={row.actor}
                    onChange={({ target }) =>
                      updateCasting(index, { actor: target.value })
                    }
                    placeholder="배우명"
                    aria-label="배우명"
                    disabled={pending}
                  />
                  {casting.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCastingRow(index)}
                      disabled={pending}
                      className="text-text-muted hover:text-destructive inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] transition-colors disabled:opacity-60"
                    >
                      삭제
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addCastingRow}
              disabled={pending}
              className="text-text-muted hover:text-primary inline-flex w-fit rounded-4xl px-2 py-1 text-[11px] underline underline-offset-2 transition-colors disabled:opacity-60"
            >
              + 배역 추가
            </button>
          </div>

          <SlotExceptionEditor
            label="회차 (날짜/시간)"
            items={slots}
            disabled={pending}
            onChange={setSlots}
          />

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="border-border text-text hover:bg-point inline-flex rounded-4xl border px-3 py-1 text-xs transition-colors disabled:opacity-60"
            >
              {pending ? "등록하는 중…" : "등록하기"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="text-text-muted inline-flex rounded-4xl px-3 py-1 text-xs underline underline-offset-2 disabled:opacity-60"
            >
              취소
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
};
