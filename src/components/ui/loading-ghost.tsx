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
    <Image
      src="/logo.png"
      alt=""
      width={64}
      height={64}
      className="size-16 animate-spin"
    />
    <p className="text-base font-medium text-text-muted">{label}</p>
  </div>
);
