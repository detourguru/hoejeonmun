import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full border text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      selected: {
        true: "border-primary bg-primary text-primary-foreground",
        false: "border-border bg-surface text-text hover:bg-hover",
      },
      size: {
        sm: "h-tap-sm px-3",
        md: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: {
      selected: false,
      size: "sm",
    },
  },
);

function Chip({
  className,
  selected,
  size,
  render,
  ...props
}: useRender.ComponentProps<"button"> & VariantProps<typeof chipVariants>) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: "button",
        "aria-pressed": selected ?? undefined,
        className: cn(chipVariants({ selected, size }), className),
      },
      props,
    ),
    render,
    state: { slot: "chip", selected: Boolean(selected) },
  });
}

function RemovableChip({
  label,
  onRemove,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${label} 빼기`}
      className={cn(chipVariants({ selected: true, size: "sm" }), className)}
      {...props}
    >
      {label}
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

export { Chip, RemovableChip, chipVariants };
