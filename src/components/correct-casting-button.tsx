"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  correctSlotCasting,
  correctSlotDate,
} from "@/app/(main)/show/[id]/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CorrectableCasting = { role: string; actor: string };

export const CorrectCastingButton = ({
  showId,
  slotId,
  date,
  time,
  castings,
}: {
  showId: string;
  slotId: number;
  date: string;
  time: string;
  castings: CorrectableCasting[];
}) => {
  const router = useRouter();

  // 앙상블처럼 같은 배역에 배우가 여럿이면 배역명만으로 정정 대상을 특정할 수
  // 없어서 배역+배우 쌍을 골라야 한다
  const uniqueCastings = [
    ...new Map(
      castings.map((casting) => [`${casting.role} ${casting.actor}`, casting]),
    ).values(),
  ];

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [oldActor, setOldActor] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [actor, setActor] = useState("");
  const [newDate, setNewDate] = useState(date);
  const [newTime, setNewTime] = useState(time);
  const [applyToAllSlots, setApplyToAllSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openSheet = () => {
    setRole(null);
    setOldActor(null);
    setNewRole("");
    setActor("");
    setNewDate(date);
    setNewTime(time);
    setApplyToAllSlots(false);
    setError(null);
    setOpen(true);
  };

  const selectCasting = (casting: CorrectableCasting) => {
    setRole(casting.role);
    setOldActor(casting.actor);
    setNewRole(casting.role);
    setError(null);
  };

  const handleSubmit = () => {
    const dateChanged = newDate !== date || newTime !== time;

    if (!role && !dateChanged) {
      setError("고칠 내용을 입력해 주세요.");
      return;
    }

    setError(null);

    startTransition(async () => {
      if (role && oldActor !== null) {
        const result = await correctSlotCasting(
          showId,
          slotId,
          role,
          oldActor,
          newRole,
          actor,
          applyToAllSlots,
        );

        if (!result.ok) {
          if (result.message === "로그인이 필요해요.") {
            router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
            return;
          }

          setError(result.message);
          return;
        }
      }

      if (dateChanged) {
        const result = await correctSlotDate(showId, slotId, newDate, newTime);

        if (!result.ok) {
          if (result.message === "로그인이 필요해요.") {
            router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
            return;
          }

          setError(result.message);
          return;
        }
      }

      setOpen(false);
      toast.success("정정 제안이 반영됐어요.");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="text-text-muted hover:text-primary inline-flex w-fit shrink-0 rounded-4xl px-2 py-1 text-[11px] transition-colors"
      >
        정정 제안
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title="배역 정정 제안">
        <div className="flex flex-col gap-4">
          <p className="text-text-muted text-center text-xs">
            이미지 근거 없이 텍스트로 바로 반영돼요. 배역 정정은{" "}
            {applyToAllSlots
              ? "같은 캐스팅보드에서 올라간 모든 회차 중 같은 배역·배우에 한 번에 적용되고"
              : "이 회차에만 적용되고"}
            , 날짜/시간 정정은 이 회차만 옮겨요. 배역 정정은 &quot;텍스트
            제보&quot;로 표시돼요. 신고가 쌓이면 같은 기준으로 내려가요.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="text-text-muted text-[11px] font-bold">
              날짜/시간 정정
            </span>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={newDate}
                aria-label="날짜"
                onChange={({ target }) => setNewDate(target.value)}
              />
              <Input
                type="time"
                value={newTime}
                aria-label="시간"
                onChange={({ target }) => setNewTime(target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-text-muted text-[11px] font-bold">
              배역 선택
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {uniqueCastings.map((casting) => (
                <button
                  key={`${casting.role} ${casting.actor}`}
                  type="button"
                  onClick={() => selectCasting(casting)}
                  className={cn(
                    "border-border rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    role === casting.role && oldActor === casting.actor
                      ? "border-primary bg-primary text-white"
                      : "text-text",
                  )}
                >
                  {casting.role} · {casting.actor}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-text-muted text-[11px] font-bold">
              배역명
            </span>
            <Input
              value={newRole}
              onChange={({ target }) => setNewRole(target.value)}
              placeholder="정정할 배역명"
              aria-label="배역명"
              disabled={!role}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-text-muted text-[11px] font-bold">
              배우명
            </span>
            <Input
              value={actor}
              onChange={({ target }) => setActor(target.value)}
              placeholder="정정할 배우명"
              aria-label="배우명"
              disabled={!role}
            />
          </div>

          <label className="text-text-muted flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={applyToAllSlots}
              onChange={({ target }) => setApplyToAllSlots(target.checked)}
              disabled={!role}
            />
            같은 배역·배우, 다른 회차에도 적용
          </label>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="border-border text-text hover:bg-point inline-flex rounded-4xl border px-3 py-1 text-xs transition-colors disabled:opacity-60"
            >
              정정 제안하기
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-text-muted inline-flex rounded-4xl px-3 py-1 text-xs underline underline-offset-2"
            >
              취소
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
};
