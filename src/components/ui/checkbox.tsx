import { cn } from "@/lib/utils";

export const Checkbox = ({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { label: string }) => (
  <label
    className={cn(
      "text-text-muted has-checked:text-text min-h-tap-sm flex w-fit cursor-pointer items-center gap-2 text-xs transition-colors select-none",
      className,
    )}
  >
    <input
      type="checkbox"
      className="size-4 shrink-0 cursor-pointer rounded-[0.25rem]"
      {...props}
    />
    {label}
  </label>
);
