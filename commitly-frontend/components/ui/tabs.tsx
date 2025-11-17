"use client";

import {
  Content as TabsPrimitiveContent,
  List as TabsPrimitiveList,
  Root as TabsPrimitiveRoot,
  Trigger as TabsPrimitiveTrigger,
} from "@radix-ui/react-tabs";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitiveRoot;

const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitiveList>,
  ComponentPropsWithoutRef<typeof TabsPrimitiveList>
>(({ className, ...props }, ref) => (
  <TabsPrimitiveList
    className={cn(
      "inline-flex items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    ref={ref}
    {...props}
  />
));
TabsList.displayName = TabsPrimitiveList.displayName;

const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitiveTrigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitiveTrigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitiveTrigger
    className={cn(
      "inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-md px-4 py-2 font-medium text-sm transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:opacity-70 data-[state=active]:shadow data-[state=inactive]:hover:opacity-100",
      className
    )}
    ref={ref}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitiveTrigger.displayName;

const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitiveContent>,
  ComponentPropsWithoutRef<typeof TabsPrimitiveContent>
>(({ className, ...props }, ref) => (
  <TabsPrimitiveContent
    className={cn(
      "rounded-lg border border-border bg-card p-6 text-foreground text-sm shadow-sm focus-visible:outline-none",
      className
    )}
    ref={ref}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitiveContent.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
