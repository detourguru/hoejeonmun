import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "border-border bg-surface flex min-w-0 rounded-card border",
  {
    variants: {
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-5",
      },
      direction: {
        row: "flex-row",
        col: "flex-col",
      },
      interactive: {
        true: "hover:border-primary/40 hover:bg-hover transition-colors",
        false: "",
      },
    },
    defaultVariants: {
      padding: "sm",
      direction: "col",
      interactive: false,
    },
  },
);

function Card({
  className,
  padding,
  direction,
  interactive,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          cardVariants({ padding, direction, interactive }),
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "card" },
  });
}

export { Card, cardVariants };
