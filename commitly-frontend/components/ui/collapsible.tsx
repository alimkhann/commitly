"use client";

import {
  CollapsibleContent as CollapsiblePrimitiveContent,
  Root as CollapsiblePrimitiveRoot,
  CollapsibleTrigger as CollapsiblePrimitiveTrigger,
} from "@radix-ui/react-collapsible";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";

import { cn } from "@/lib/utils";

const Collapsible = CollapsiblePrimitiveRoot;

const CollapsibleTrigger = CollapsiblePrimitiveTrigger;

const CollapsibleContent = forwardRef<
  ElementRef<typeof CollapsiblePrimitiveContent>,
  ComponentPropsWithoutRef<typeof CollapsiblePrimitiveContent>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitiveContent
    className={cn(
      "overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      className
    )}
    ref={ref}
    {...props}
  />
));
CollapsibleContent.displayName = CollapsiblePrimitiveContent.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
