"use client";

import {
  Corner as ScrollAreaPrimitiveCorner,
  Root as ScrollAreaPrimitiveRoot,
  ScrollAreaScrollbar as ScrollAreaPrimitiveScrollbar,
  ScrollAreaThumb as ScrollAreaPrimitiveThumb,
  Viewport as ScrollAreaPrimitiveViewport,
} from "@radix-ui/react-scroll-area";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";

import { cn } from "@/lib/utils";

const ScrollArea = forwardRef<
  ElementRef<typeof ScrollAreaPrimitiveRoot>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitiveRoot>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitiveRoot
    className={cn("relative overflow-hidden", className)}
    ref={ref}
    {...props}
  >
    <ScrollAreaPrimitiveViewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitiveViewport>
    <ScrollBar />
    <ScrollAreaPrimitiveCorner />
  </ScrollAreaPrimitiveRoot>
));
ScrollArea.displayName = ScrollAreaPrimitiveRoot.displayName;

const ScrollBar = forwardRef<
  ElementRef<typeof ScrollAreaPrimitiveScrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitiveScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitiveScrollbar
    className={cn(
      "flex touch-none select-none transition-colors data-[orientation=horizontal]:h-2 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2",
      className
    )}
    orientation={orientation}
    ref={ref}
    {...props}
  >
    <ScrollAreaPrimitiveThumb className="relative flex-1 rounded-full bg-muted" />
  </ScrollAreaPrimitiveScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitiveScrollbar.displayName;

export { ScrollArea, ScrollBar };
