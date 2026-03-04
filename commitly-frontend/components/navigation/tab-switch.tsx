"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePreferences } from "@/components/providers/preferences-provider";

import { cn } from "@/lib/utils";

type TabSwitchProps = {
  repoId: string;
};

export default function TabSwitch({ repoId }: TabSwitchProps) {
  const { t } = usePreferences();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const fullName = searchParams.get("fullName");
  const isGuide = view === "guide";
  const timelineHref = fullName
    ? `/repo/${repoId}?view=timeline&fullName=${encodeURIComponent(fullName)}`
    : `/repo/${repoId}?view=timeline`;
  const guideHref = fullName
    ? `/repo/${repoId}?view=guide&fullName=${encodeURIComponent(fullName)}`
    : `/repo/${repoId}?view=guide`;

  return (
    <div className="inline-flex items-center rounded-full border border-border/70 bg-card p-1 text-sm">
      <Link
        className={cn(
          "rounded-full px-6 py-2 font-medium transition-colors",
          !isGuide
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        href={timelineHref}
        replace
      >
        {t("timeline", "Timeline")}
      </Link>
      <Link
        className={cn(
          "rounded-full px-6 py-2 font-medium transition-colors",
          isGuide
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        href={guideHref}
        replace
      >
        {t("guide", "Guide")}
      </Link>
    </div>
  );
}
