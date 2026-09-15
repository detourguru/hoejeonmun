import { User } from "lucide-react";
import { Suspense } from "react";

import { getMyContributionStats } from "@/service/mypage";

const STAT_LABELS = ["담은 배우", "올린 캐스팅보드", "제보한 회차"] as const;

export const ProfileHero = ({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string | null;
}) => {
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
        <Suspense
          fallback={STAT_LABELS.map((label) => (
            <Stat key={label} label={label} />
          ))}
        >
          <ProfileStats userId={userId} />
        </Suspense>
      </div>
    </div>
  );
};

const ProfileStats = async ({ userId }: { userId: string }) => {
  const stats = await getMyContributionStats(userId);
  const values = [
    stats.favoriteActorCount,
    stats.uploadCount,
    stats.reportedSlotCount,
  ];

  return STAT_LABELS.map((label, index) => (
    <Stat key={label} value={values[index]} label={label} />
  ));
};

const Stat = ({ value, label }: { value?: number; label: string }) => (
  <div className="flex flex-1 flex-col gap-0.5">
    <span className="text-primary text-lg font-extrabold">{value ?? "-"}</span>
    <span className="text-text-muted text-[10px]">{label}</span>
  </div>
);
