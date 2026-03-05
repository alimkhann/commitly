"use client";

import { Badge } from "@/components/ui/badge";
import type { GlobalUsage } from "@/lib/services/repos";
import { cn } from "@/lib/utils";

const MODE_BADGE_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  normal: "secondary",
  low: "outline",
  critical: "destructive",
};

type SharedTokenPoolCardProps = {
  usage: GlobalUsage | null;
  t: (key: string, fallback?: string) => string;
  className?: string;
};

export function SharedTokenPoolCard({ usage, t, className }: SharedTokenPoolCardProps) {
  if (!usage) {
    return null;
  }

  const mode = String(usage.mode ?? "normal").toLowerCase();
  const modeVariant = MODE_BADGE_VARIANT[mode] ?? "outline";

  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card px-5 py-4 text-left", className)}>
      <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
        {t("shared_token_pool", "Shared AI token pool")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="font-medium text-sm">
          {usage.remaining.toLocaleString()} / {usage.daily_limit.toLocaleString()}{" "}
          {t("tokens_left", "tokens left")}
        </p>
        <Badge className="uppercase tracking-wide" variant={modeVariant}>
          {t("mode", "Mode")}: {usage.mode}
        </Badge>
      </div>
      <p className="mt-1 text-muted-foreground text-xs">
        {t("resets", "resets")} {new Date(usage.reset_at).toLocaleString()}
      </p>
      {typeof usage.user_daily_limit === "number" && (
        <p className="mt-2 text-muted-foreground text-xs">
          {t("your_plan_budget", "Your plan budget")}:{" "}
          {(usage.plan_tier ?? "free").toUpperCase()} ·{" "}
          {(usage.user_remaining ?? 0).toLocaleString()} / {usage.user_daily_limit.toLocaleString()}{" "}
          {t("tokens_left", "tokens left")}
        </p>
      )}
      {mode === "low" && (
        <p className="mt-2 text-amber-600 text-xs dark:text-amber-400">
          {t(
            "shared_pool_low_hint",
            "Pool is in low mode. Generation may slow down and use cheaper model settings."
          )}
        </p>
      )}
      {mode === "critical" && (
        <p className="mt-2 text-destructive text-xs">
          {t(
            "shared_pool_critical_hint",
            "Pool is exhausted. New roadmap generation is paused until reset."
          )}
        </p>
      )}
      {usage.provider_limited && (
        <p className="mt-2 text-destructive text-xs">
          {t(
            "provider_rate_limited_hint",
            "Gemini provider limits are currently throttling generation."
          )}{" "}
          {usage.provider_retry_at
            ? `${t("retry_after", "Retry after")} ${new Date(usage.provider_retry_at).toLocaleString()}`
            : ""}
        </p>
      )}
    </div>
  );
}
