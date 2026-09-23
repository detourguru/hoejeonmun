import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@/lib/utils";

function SegmentedControl({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="tablist"
      data-slot="segmented-control"
      className={cn("bg-sub rounded-card flex w-fit gap-0.5 p-0.5", className)}
      {...props}
    />
  );
}

function SegmentedItem({
  className,
  selected = false,
  render,
  ...props
}: useRender.ComponentProps<"button"> & { selected?: boolean }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        role: "tab",
        "aria-selected": selected,
        className: cn(
          "flex h-tap-sm items-center justify-center rounded-control px-4 text-sm font-medium transition-colors",
          selected
            ? "bg-surface text-primary shadow-sm"
            : "text-text-muted hover:text-text",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "segmented-item", selected },
  });
}

export { SegmentedControl, SegmentedItem };
