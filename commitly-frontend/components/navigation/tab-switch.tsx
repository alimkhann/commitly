"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

type TabSwitchProps = {
  repoId: string;
};

export default function TabSwitch({ repoId }: TabSwitchProps) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const isGuide = view === "guide";

  return (
    <div className="inline-flex items-center rounded-full border border-border/70 bg-[#0d1117] p-1 text-sm">
      <Link
        className={cn(
          "rounded-full px-6 py-2 font-medium transition-colors",
          !isGuide
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        href={`/repo/${repoId}?view=timeline`}
        replace
      >
        Timeline
      </Link>
      <Link
        className={cn(
          "rounded-full px-6 py-2 font-medium transition-colors",
          isGuide
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        href={`/repo/${repoId}?view=guide`}
        replace
      >
        Guide
      </Link>
    </div>
  );
}
