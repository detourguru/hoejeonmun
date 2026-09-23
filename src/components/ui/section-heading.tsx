import { cn } from "@/lib/utils";

export const SectionHeading = ({
  title,
  size = "lg",
  action,
  className,
}: {
  title: string;
  size?: "sm" | "lg";
  action?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex items-center justify-between gap-2", className)}>
    <h2
      className={cn(
        "text-text font-bold",
        size === "lg" ? "text-lg" : "text-sm",
      )}
    >
      {title}
    </h2>
    {action}
  </div>
);
