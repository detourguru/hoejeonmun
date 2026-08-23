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
      "flex flex-col items-center justify-center gap-2 py-16",
      className,
    )}
  >
    <Image
      src="/logo.png"
      alt=""
      width={48}
      height={48}
      className="size-12 animate-spin"
    />
    <p className="text-sm text-text-muted">{label}</p>
  </div>
);
