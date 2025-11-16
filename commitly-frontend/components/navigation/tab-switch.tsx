"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type TabSwitchProps = {
  repoId: string;
};

export default function TabSwitch({ repoId }: TabSwitchProps) {
  const pathname = usePathname() || "";

  const tabs = [
    { label: "Timeline", href: `/repo/${repoId}/timeline` },
    { label: "Guide", href: `/repo/${repoId}/guide` },
  ];

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card/60 p-1 text-sm shadow-black/20 shadow-lg backdrop-blur">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            className={cn(
              "rounded-full px-6 py-2 font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
