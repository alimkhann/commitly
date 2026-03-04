"use client";

import { useSearchParams } from "next/navigation";
import GuideView from "@/components/repo/guide-view";
import TimelineView from "@/components/repo/timeline-view";

export default function RepoPage() {
  const searchParams = useSearchParams();
  const view = searchParams?.get("view") ?? "timeline";
  const isGuide = view === "guide";

  return isGuide ? <GuideView /> : <TimelineView />;
}
