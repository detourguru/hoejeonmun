"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { correctSlotCasting } from "@/app/(main)/show/[id]/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const CorrectCastingButton = ({
  showId,
  slotId,
  roles,
}: {
  showId: string;
  slotId: number;
  roles: string[];
}) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [actor, setActor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openSheet = () => {
    setRole(null);
    setNewRole("");
    setActor("");
    setError(null);
    setOpen(true);
  };

  const selectRole = (value: string) => {
    setRole(value);
    setNewRole(value);
    setError(null);
  };

  const handleSubmit = () => {
    if (!role) {
      setError("배역을 선택해 주세요.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await correctSlotCasting(
        showId,
        slotId,
        role,
        newRole,
        actor,
      );

      if (!result.ok) {
        if (result.message === "로그인이 필요해요.") {
          router.push(`/login?next=${encodeURIComponent(`/show/${showId}`)}`);
          return;
        }

        setError(result.message);
        return;
      }

      setOpen(false);
      toast.success(
        result.count > 1
          ? `정정 제안이 반영됐어요. (${result.count}개 회차)`
          : "정정 제안이 반영됐어요.",
      );
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
            이미지 근거 없이 텍스트로 바로 반영돼요. 같은 캐스팅보드에서 올라간
            모든 회차 중 같은 배역에 한 번에 적용되고, &quot;텍스트 제보&quot;로
            표시돼요. 신고가 쌓이면 같은 기준으로 내려가요.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="text-text-muted text-[11px] font-bold">
              배역 선택
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {roles.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectRole(value)}
                  className={cn(
                    "border-border rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    role === value
                      ? "border-primary bg-primary text-white"
                      : "text-text",
                  )}
                >
                  {value}
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
