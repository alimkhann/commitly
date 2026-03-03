import "@/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { type ReactNode, Suspense } from "react";
import HomeBackground from "@/components/layout/home-background";
import SidebarWrapper from "@/components/layout/sidebar/sidebar-wrapper";
import { LayoutProvider } from "@/components/providers/layout-provider";
import { RoadmapCatalogProvider } from "@/components/providers/roadmap-catalog-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "commitly",
    template: "%s · commitly",
  },
  description:
    "commitly turns a GitHub repo into a structured learning path with hands-on tasks, pragmatic hints, and context-aware guidance.",
  icons: [{ rel: "icon", url: "/icons/icon_05x.png" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        theme: dark,
        variables: {
          colorBackground: "#050507",
          borderRadius: "0.3rem",
        },
        elements: {
          card: "text-foreground border-none border-white/8 shadow-[0_35px_70px_rgba(0,0,0,0.65)]",
          formFieldInput: "bg-white/5",
          headerTitle: "text-white",
          headerSubtitle: "text-white/70",
          socialButtonsBlockButton:
            "text-foreground border border-white/12 hover:bg-white/10 transition-colors",
          formButtonPrimary:
            "bg-primary text-primary-foreground hover:bg-primary/85 shadow-[0_15px_35px_rgba(125,211,252,0.45)] transition-all",
          footerActionLink: "text-primary hover:text-primary/80",
        },
      }}
    >
      <html className="dark" lang="en">
        <body
          className={`${inter.variable} ${jetBrainsMono.variable} bg-background text-foreground`}
        >
          <RoadmapCatalogProvider>
            <LayoutProvider>
              <HomeBackground />
              <div className="flex h-screen w-full overflow-hidden">
                <Suspense fallback={null}>
                  <SidebarWrapper />
                </Suspense>
                <main className="relative flex h-full flex-1 flex-col overflow-y-auto overflow-x-hidden">
                  {children}
                </main>
              </div>
            </LayoutProvider>
          </RoadmapCatalogProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
