import "@/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { type ReactNode, Suspense } from "react";
import SidebarWrapper from "@/components/layout/sidebar/sidebar-wrapper";
import { LayoutProvider } from "@/components/providers/layout-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
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

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isProdRuntime =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";
const hasTestClerkKeyInProd =
  isProdRuntime && clerkPublishableKey.startsWith("pk_test_");

if (hasTestClerkKeyInProd) {
  console.error(
    "[commitly] Production runtime is using a Clerk test publishable key (pk_test_*). Switch to production Clerk keys immediately."
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorBackground: "hsl(var(--background))",
          colorText: "hsl(var(--foreground))",
          borderRadius: "0.3rem",
        },
        elements: {
          card: "text-foreground border border-border bg-background shadow-xl",
          formFieldInput: "bg-background border-border",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton:
            "text-foreground border border-border hover:bg-accent transition-colors",
          formButtonPrimary:
            "bg-primary text-primary-foreground hover:bg-primary/85 transition-colors",
          footerActionLink: "text-primary hover:text-primary/80",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${inter.variable} ${jetBrainsMono.variable} bg-background text-foreground`}
        >
          {hasTestClerkKeyInProd && (
            <div className="border-destructive/40 border-b bg-destructive/15 px-4 py-2 text-center text-destructive text-sm">
              Clerk production key is not configured. Replace `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` with a production key.
            </div>
          )}
          <PreferencesProvider>
            <RoadmapCatalogProvider>
              <LayoutProvider>
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
          </PreferencesProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
