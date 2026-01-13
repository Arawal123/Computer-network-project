"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        info: "border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10",
        warn: "border-yellow-400/40 text-yellow-200 bg-yellow-400/10",
        crit: "border-red-500/40 text-red-300 bg-red-500/10",
        ok: "border-emerald-400/40 text-emerald-200 bg-emerald-400/10",
        neutral: "border-white/10 text-white/60 bg-white/5"
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
