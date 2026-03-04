"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLayout } from "@/components/providers/layout-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import Sidebar from "./sidebar";

const HIDE_SIDEBAR_PREFIXES = [
  "/help-center",
  "/release-notes",
  "/policies",
  "/plans",
];

export default function SidebarWrapper() {
  const pathname = usePathname() || "/";
  const { isLeftSidebarCollapsed } = useLayout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const shouldHide = HIDE_SIDEBAR_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    // Close mobile drawer after route transitions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  if (shouldHide) {
    return null;
  }

  return (
    <>
      <Button
        aria-label="Open sidebar"
        className="fixed left-4 top-4 z-40 h-10 w-10 border border-border/70 bg-card lg:hidden"
        onClick={() => setMobileOpen(true)}
        size="icon"
        variant="secondary"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {mobileOpen && (
        <button
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[320px] border-r border-border/70 bg-background transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar />
      </aside>

      <aside
        className={cn(
          "hidden h-full shrink-0 border-r border-border/70 bg-background lg:flex",
          isLeftSidebarCollapsed ? "w-[80px]" : "w-[300px]"
        )}
      >
        <Sidebar />
      </aside>
    </>
  );
}
