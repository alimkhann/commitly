"use client"

import { useState } from "react"
import { AlertTriangle, Paperclip } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type ReportBugProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ReportBug({ open, onOpenChange }: ReportBugProps) {
  const [includeScreenshot, setIncludeScreenshot] = useState(true)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl space-y-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle>Report an issue</DialogTitle>
          </div>
          <DialogDescription>
            Share what went wrong so we can reproduce and fix it quickly. Attaching
            screenshots or logs helps shorten the cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="bug-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="bug-title"
              placeholder="Streaming output stops after a few tokens"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="bug-description" className="text-sm font-medium">
              What happened?
            </label>
            <Textarea
              id="bug-description"
              rows={6}
              placeholder="Steps to reproduce, expected result, actual outcome..."
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-dashed border-muted px-3 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              <div>
                <p className="font-medium text-foreground">Attachment</p>
                <p className="text-xs text-muted-foreground">
                  Drop screenshots or logs (optional)
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Browse files
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Include last screenshot</p>
              <p className="text-xs text-muted-foreground">
                We&rsquo;ll only capture the active commitly tab.
              </p>
            </div>
            <Switch
              checked={includeScreenshot}
              onCheckedChange={setIncludeScreenshot}
              aria-label="Include screenshot"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button>Send report</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
