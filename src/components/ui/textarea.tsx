import { cn } from "@/lib/utils";

export const Textarea = ({
  className,
  ...props
}: React.ComponentProps<"textarea">) => (
  <textarea
    data-slot="textarea"
    className={cn(
      "border-input bg-surface text-text placeholder:text-text-muted focus-visible:border-ring focus-visible:ring-ring/50 rounded-control w-full resize-y border px-3 py-2 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className,
    )}
    {...props}
  />
);
