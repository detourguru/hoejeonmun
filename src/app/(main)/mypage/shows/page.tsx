import { Calendar } from "lucide-react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 공연 | 회전문",
};

export default function Page() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <span className="bg-point/40 flex size-14 items-center justify-center rounded-full">
        <Calendar className="text-primary size-6" />
      </span>
      <p className="text-text-muted text-sm">
        곧 만나요! 담아둔 회차와 이벤트를
        <br />한 달력에서 볼 수 있게 준비 중이에요.
      </p>
    </div>
  );
}
