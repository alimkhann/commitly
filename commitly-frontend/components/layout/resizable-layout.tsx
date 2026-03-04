"use client";

import * as React from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { useLayout } from "@/components/providers/layout-provider";
import { cn } from "@/lib/utils";

interface ResizableLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
}

export function ResizableLayout({
  sidebar,
  children,
  rightSidebar,
}: ResizableLayoutProps) {
  const {
    isLeftSidebarCollapsed,
    setLeftSidebarCollapsed,
    isRightSidebarOpen,
    isFullscreen,
  } = useLayout();

  const leftPanelRef = React.useRef<ImperativePanelHandle>(null);
  const rightPanelRef = React.useRef<ImperativePanelHandle>(null);

  React.useEffect(() => {
    const panel = leftPanelRef.current;
    if (panel) {
      if (isLeftSidebarCollapsed) {
        panel.collapse();
      } else {
        panel.expand();
      }
    }
  }, [isLeftSidebarCollapsed]);

  return (
    <PanelGroup
      direction="horizontal"
      className="h-screen w-full overflow-hidden bg-background"
      id="app-layout-panels"
    >
      <Panel
        ref={leftPanelRef}
        id="left-sidebar"
        defaultSize={20}
        collapsedSize={4}
        collapsible={true}
        minSize={15}
        maxSize={30}
        onCollapse={() => setLeftSidebarCollapsed(true)}
        onExpand={() => setLeftSidebarCollapsed(false)}
        className={cn(
          "transition-all duration-300 ease-in-out",
          isLeftSidebarCollapsed && "min-w-[80px]"
        )}
      >
        {sidebar}
      </Panel>

      <PanelResizeHandle className="w-px bg-border/10 hover:bg-border/50 transition-colors" />

      <Panel
        id="main-content"
        defaultSize={isRightSidebarOpen ? 50 : 80}
        minSize={30}
      >
        <main className="relative flex h-full flex-col overflow-hidden">
          {children}
        </main>
      </Panel>

      {isRightSidebarOpen && rightSidebar && (
        <>
          <PanelResizeHandle className="w-px bg-border/10 hover:bg-border/50 transition-colors" />
          <Panel
            ref={rightPanelRef}
            id="right-sidebar"
            defaultSize={30}
            minSize={20}
            maxSize={isFullscreen ? 100 : 80}
            className={cn(
              "bg-card transition-all duration-300 ease-in-out",
              isFullscreen && "absolute inset-0 z-50 h-full w-full"
            )}
          >
            {rightSidebar}
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}
