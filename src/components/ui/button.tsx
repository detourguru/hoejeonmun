import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:opacity-90 aria-expanded:opacity-90",
        point:
          "bg-point text-point-foreground hover:opacity-90 aria-expanded:opacity-90",
        outline:
          "border-border bg-surface text-text hover:bg-hover aria-expanded:bg-hover",
        secondary: "bg-sub text-text hover:bg-hover aria-expanded:bg-hover",
        ghost: "text-text hover:bg-hover aria-expanded:bg-hover",
        quiet: "text-text-muted hover:bg-hover hover:text-text",
        danger:
          "text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/20",
        link: "text-primary underline underline-offset-2 hover:opacity-80",
      },
      size: {
        sm: "h-tap-sm gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-10 px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-tap px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        block:
          "h-12 w-full px-4 text-base font-bold [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-tap-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-10 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-tap [&_svg:not([class*='size-'])]:size-5",
      },
      shape: {
        control: "rounded-control",
        pill: "rounded-full",
      },
    },
    compoundVariants: [
      {
        variant: "link",
        className: "h-auto gap-1 px-0 hover:bg-transparent",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      shape: "control",
    },
  },
);

function Button({
  className,
  variant,
  size,
  shape,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
