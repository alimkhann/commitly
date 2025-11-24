"use client";

import { usePathname } from "next/navigation";
import { useLayout } from "@/components/providers/layout-provider";
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
  const shouldHide = HIDE_SIDEBAR_PREFIXES.some((p) => pathname.startsWith(p));

  if (shouldHide) {
    return null;
  }

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 border-white/10 border-r bg-card/20 backdrop-blur-xl",
        isLeftSidebarCollapsed ? "w-[80px]" : "w-[300px]"
      )}
    >
      <Sidebar />
    </aside>
  );
}
