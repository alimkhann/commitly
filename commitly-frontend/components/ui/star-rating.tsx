"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  value: number; // 0-5, can be fractional for average
  onValueChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}

export function StarRating({
  value,
  onValueChange,
  readonly = false,
  size = "md",
  showValue = false,
  className,
}: StarRatingProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const handleClick = (newValue: number) => {
    if (!readonly && onValueChange) {
      onValueChange(newValue);
    }
  };

  const handleMouseEnter = (hoverValue: number) => {
    if (!readonly) {
      // Optional: Add hover state if needed
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((starValue) => {
          const isFilled = value >= starValue;
          const isHalfFilled = value >= starValue - 0.5 && value < starValue;

          return (
            <button
              className={cn(
                "transition-colors",
                !readonly && "cursor-pointer hover:opacity-80",
                readonly && "cursor-default"
              )}
              disabled={readonly}
              key={starValue}
              onClick={() => handleClick(starValue)}
              onMouseEnter={() => handleMouseEnter(starValue)}
              type="button"
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  isFilled
                    ? "fill-yellow-400 text-yellow-400"
                    : isHalfFilled
                      ? "fill-yellow-400/50 text-yellow-400/50"
                      : "fill-none text-muted-foreground/30"
                )}
              />
            </button>
          );
        })}
      </div>
      {showValue && value > 0 && (
        <span className="ml-1 text-muted-foreground text-xs">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
