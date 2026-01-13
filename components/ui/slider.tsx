"use client";

import * as React from "react";
import * as SliderPrimitives from "@radix-ui/react-slider";
import { cn } from "../../lib/cn";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitives.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitives.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/10">
      <SliderPrimitives.Range className="absolute h-full bg-neon-cyan/70" />
    </SliderPrimitives.Track>
    <SliderPrimitives.Thumb className="block h-4 w-4 rounded-full border border-neon-cyan/50 bg-white shadow-glow" />
  </SliderPrimitives.Root>
));
Slider.displayName = SliderPrimitives.Root.displayName;

export { Slider };
