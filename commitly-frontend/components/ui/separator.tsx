import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SeparatorProps = HTMLAttributes<HTMLDivElement> & {
  decorative?: boolean;
  orientation?: "horizontal" | "vertical";
};

const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => {
    const role = decorative ? "none" : "separator";
    const ariaProps =
      role === "separator" ? { "aria-orientation": orientation } : {};
    return (
      <div
        className={cn(
          "shrink-0 bg-border",
          orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
          className
        )}
        ref={ref}
        role={role}
        {...ariaProps}
        {...props}
      />
    );
  }
);
Separator.displayName = "Separator";

export { Separator };
