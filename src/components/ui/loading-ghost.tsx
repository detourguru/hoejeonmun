import Image from "next/image";

import { cn } from "@/lib/utils";

export const LoadingGhost = ({
  className,
  label = "불러오는 중...",
}: {
  className?: string;
  label?: string;
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 py-16",
      className,
    )}
  >
    <div className="relative flex size-20 items-center justify-center">
      <div
        className="border-t-point border-r-point/35 animate-ring-spin absolute inset-0 rounded-full border-[3px] border-transparent"
        aria-hidden
      />
      <Image
        src="/logo.png"
        alt=""
        width={56}
        height={56}
        className="size-14"
      />
    </div>
    <p className="text-text-muted text-base font-medium">{label}</p>
  </div>
);
