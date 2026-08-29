import { User } from "lucide-react";

import { getMyContributionStats } from "@/service/mypage";

export const ProfileHero = async ({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string | null;
}) => {
  const stats = await getMyContributionStats(userId);

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-2xl border p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="bg-point/40 border-point flex size-11 shrink-0 items-center justify-center rounded-full border-2">
          <User className="text-primary size-5" />
        </span>
        <div>
          <p className="text-text text-sm font-bold">
            {displayName ? `${displayName}님` : "회원님"}
          </p>
          <p className="text-text-muted text-[11px]">카카오 계정으로 로그인 중</p>
        </div>
      </div>

      <div className="border-border flex border-t pt-3.5">
        <Stat value={stats.favoriteActorCount} label="담은 배우" />
        <Stat value={stats.uploadCount} label="올린 캐스팅보드" />
        <Stat value={stats.reportedSlotCount} label="제보한 회차" />
      </div>
    </div>
  );
};

const Stat = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-1 flex-col gap-0.5">
    <span className="text-primary text-lg font-extrabold">{value}</span>
    <span className="text-text-muted text-[10px]">{label}</span>
  </div>
);
