"use client"

import { UserProfile } from "@clerk/nextjs"
import { dark } from "@clerk/themes"

import { Dialog, DialogContent } from "@/components/ui/dialog"

type AccountSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AccountSettingsDialog({
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
          <UserProfile
            routing="hash"
            appearance={{
              baseTheme: dark,
              variables: {
                colorBackground: "#050505",
                colorText: "#f4f4f5",
                colorPrimary: "#f6f6f6",
                borderRadius: "0.5rem",
                colorBorder: "000000",
              },
              elements: {
                card: "bg-transparent text-foreground border border-border/60 rounded-3xl",
                rootBox: "w-full",
                navbar: "bg-transparent border-r border-border/40",
                navbarButton: "text-foreground",
                pageScrollBox: "bg-transparent",
                profileSection: "bg-transparent",
                profileSectionTitle: "text-muted-foreground",
                headerTitle: "text-foreground",
                headerSubtitle: "text-muted-foreground",
                input: "bg-background text-foreground border border-border",
                select: "bg-background text-foreground border border-border",
                formButtonPrimary:
                  "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
              },
            }}
          />
      </DialogContent>
    </Dialog>
  )
}
