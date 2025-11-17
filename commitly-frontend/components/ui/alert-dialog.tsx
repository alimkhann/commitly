"use client";

import {
  Action as AlertDialogPrimitiveAction,
  Cancel as AlertDialogPrimitiveCancel,
  Content as AlertDialogPrimitiveContent,
  Description as AlertDialogPrimitiveDescription,
  Overlay as AlertDialogPrimitiveOverlay,
  Portal as AlertDialogPrimitivePortal,
  Root as AlertDialogPrimitiveRoot,
  Title as AlertDialogPrimitiveTitle,
  Trigger as AlertDialogPrimitiveTrigger,
} from "@radix-ui/react-alert-dialog";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
  type HTMLAttributes,
} from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AlertDialog = AlertDialogPrimitiveRoot;

const AlertDialogTrigger = AlertDialogPrimitiveTrigger;

const AlertDialogPortal = AlertDialogPrimitivePortal;

const AlertDialogOverlay = forwardRef<
  ElementRef<typeof AlertDialogPrimitiveOverlay>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitiveOverlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitiveOverlay
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitiveOverlay.displayName;

const AlertDialogContent = forwardRef<
  ElementRef<typeof AlertDialogPrimitiveContent>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitiveContent>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitiveContent
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in sm:rounded-lg",
        className
      )}
      ref={ref}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitiveContent.displayName;

const AlertDialogHeader = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = forwardRef<
  ElementRef<typeof AlertDialogPrimitiveTitle>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitiveTitle>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitiveTitle
    className={cn("font-semibold text-lg", className)}
    ref={ref}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitiveTitle.displayName;

const AlertDialogDescription = forwardRef<
  ElementRef<typeof AlertDialogPrimitiveDescription>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitiveDescription>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitiveDescription
    className={cn("text-muted-foreground text-sm", className)}
    ref={ref}
    {...props}
  />
));
AlertDialogDescription.displayName =
  AlertDialogPrimitiveDescription.displayName;

const AlertDialogAction = forwardRef<
  ElementRef<typeof AlertDialogPrimitiveAction>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitiveAction>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitiveAction
    className={cn(buttonVariants(), className)}
    ref={ref}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitiveAction.displayName;

const AlertDialogCancel = forwardRef<
  ElementRef<typeof AlertDialogPrimitiveCancel>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitiveCancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitiveCancel
    className={cn(
      buttonVariants({ variant: "outline" }),
      "mt-2 sm:mt-0",
      className
    )}
    ref={ref}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitiveCancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
