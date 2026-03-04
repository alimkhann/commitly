"use client";

import { useParams } from "next/navigation";
import GuideChat from "@/components/guide/guide-chat";
import { useLayout } from "@/components/providers/layout-provider";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, X } from "lucide-react";

export default function RightSidebar() {
  const { setRightSidebarOpen, isFullscreen, setIsFullscreen } = useLayout();
  const params = useParams();
  const repoId = params?.repoId;

  if (!repoId) {
    return null;
  }

  return (
    <div className="flex h-full flex-col border-l border-border/70 bg-card">
      <div className="flex items-center justify-between border-b border-border/70 p-4">
        <h2 className="font-semibold text-sm">Guide Chat</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setRightSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <GuideChat />
      </div>
    </div>
  );
}
