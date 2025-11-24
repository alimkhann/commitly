"use client";

import { useSearchParams } from "next/navigation";
import GuideView from "@/components/repo/guide-view";
import TimelineView from "@/components/repo/timeline-view";
import { cn } from "@/lib/utils";

export default function RepoPage() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "timeline";
  const isGuide = view === "guide";

  return (
    <>
      <div className={cn("flex-1 flex flex-col min-h-0 h-full", isGuide ? "hidden" : "flex")}>
        <TimelineView />
      </div>
      <div className={cn("flex-1 flex flex-col min-h-0 h-full", isGuide ? "flex" : "hidden")}>
        <GuideView />
      </div>
    </>
  );
}
