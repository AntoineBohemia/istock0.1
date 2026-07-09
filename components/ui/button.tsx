"use client";

import * as React from "react";
import { Slot } from "@/lib/slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px]",
    "text-sm font-medium cursor-pointer select-none",
    // movement: press = scale .97 snappy, release = ease-out
    "transition-[transform,background-color,border-color,color] duration-150 ease-[var(--ease-out)]",
    "active:scale-[0.97] active:duration-75",
    // focus: outline only, no box-shadow
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/70",
    "disabled:pointer-events-none disabled:opacity-40",
    "motion-reduce:transition-none motion-reduce:active:scale-100",
    "[&_svg]:size-[1.05rem] [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]",
        destructive:
          "bg-destructive text-white hover:bg-[var(--destructive-hover)] active:bg-[var(--destructive-active)]",
        outline:
          "border border-input bg-background text-foreground " +
          "hover:bg-foreground/[0.05] hover:border-foreground/25 active:bg-foreground/[0.09]",
        "outline-contrast":
          "border border-input bg-card text-foreground " +
          "hover:bg-foreground/[0.05] hover:border-foreground/25 active:bg-foreground/[0.09]",
        secondary:
          "bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.10] active:bg-foreground/[0.14]",
        ghost:
          "text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] active:bg-foreground/[0.10]",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[13px] rounded-[7px]",
        lg: "h-10 px-5",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      onPointerDown={(e: React.PointerEvent) => {
        if (typeof navigator !== "undefined") navigator.vibrate?.(8);
        props.onPointerDown?.(e as React.PointerEvent<HTMLButtonElement>);
      }}
      {...props}
    />
  );
}

export { Button, buttonVariants };
