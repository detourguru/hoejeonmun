import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col items-center gap-2 px-6 py-14 text-center",
      className,
    )}
  >
    <span className="bg-sub text-text-muted mb-1 flex size-14 items-center justify-center rounded-full">
      <Icon className="size-6" aria-hidden />
    </span>

    <p className="text-text font-bold">{title}</p>

    {description && (
      <p className="text-text-muted max-w-64 text-sm leading-relaxed text-balance">
        {description}
      </p>
    )}

    {action && (
      <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>
    )}
  </div>
);
