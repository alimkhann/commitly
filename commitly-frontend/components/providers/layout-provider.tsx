"use client";

import * as React from "react";

interface LayoutContextType {
  isLeftSidebarCollapsed: boolean;
  setLeftSidebarCollapsed: (collapsed: boolean) => void;
  toggleLeftSidebar: () => void;
  isRightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  toggleRightSidebar: () => void;
  rightSidebarWidth: number;
  setRightSidebarWidth: (width: number) => void;
  isFullscreen: boolean;
  setIsFullscreen: (fullscreen: boolean) => void;
}

const LayoutContext = React.createContext<LayoutContextType | undefined>(
  undefined
);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isLeftSidebarCollapsed, setLeftSidebarCollapsed] = React.useState(false);
  const [isRightSidebarOpen, setRightSidebarOpen] = React.useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = React.useState(30);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Auto-collapse left sidebar when right sidebar opens
  const handleSetRightSidebarOpen = React.useCallback((open: boolean) => {
    setRightSidebarOpen(open);
    if (open) {
      setLeftSidebarCollapsed(true);
    } else {
      // Optional: Expand left sidebar when right closes?
      // Let's keep it collapsed or restore previous state?
      // For now, let's just leave it as is or maybe expand it back if it was expanded.
      // User requirement: "when the stage sidebar opens on the right, the main sidebar on the left collapses"
      // Doesn't say it should expand back.
    }
  }, []);

  const toggleLeftSidebar = React.useCallback(() => {
    setLeftSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleRightSidebar = React.useCallback(() => {
    handleSetRightSidebarOpen(!isRightSidebarOpen);
  }, [isRightSidebarOpen, handleSetRightSidebarOpen]);

  const value = React.useMemo(
    () => ({
      isLeftSidebarCollapsed,
      setLeftSidebarCollapsed,
      toggleLeftSidebar,
      isRightSidebarOpen,
      setRightSidebarOpen: handleSetRightSidebarOpen,
      toggleRightSidebar,
      rightSidebarWidth,
      setRightSidebarWidth,
      isFullscreen,
      setIsFullscreen,
    }),
    [
      isLeftSidebarCollapsed,
      toggleLeftSidebar,
      isRightSidebarOpen,
      handleSetRightSidebarOpen,
      toggleRightSidebar,
      rightSidebarWidth,
      isFullscreen,
    ]
  );

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = React.useContext(LayoutContext);
  if (context === undefined) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
}
