"use client";

import { AlertTriangle, Paperclip } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type ReportBugProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ReportBug({ open, onOpenChange }: ReportBugProps) {
  const [includeScreenshot, setIncludeScreenshot] = useState(true);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl space-y-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DialogTitle>Report an issue</DialogTitle>
          </div>
          <DialogDescription>
            Share what went wrong so we can reproduce and fix it quickly.
            Attaching screenshots or logs helps shorten the cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="bug-title">
              Title
            </label>
            <Input
              id="bug-title"
              placeholder="Streaming output stops after a few tokens"
            />
          </div>

          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="bug-description">
              What happened?
            </label>
            <Textarea
              id="bug-description"
              placeholder="Steps to reproduce, expected result, actual outcome..."
              rows={6}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-muted border-dashed px-3 py-3 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              <div>
                <p className="font-medium text-foreground">Attachment</p>
                <p className="text-muted-foreground text-xs">
                  Drop screenshots or logs (optional)
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline">
              Browse files
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
            <div>
              <p className="font-medium text-sm">Include last screenshot</p>
              <p className="text-muted-foreground text-xs">
                We&rsquo;ll only capture the active commitly tab.
              </p>
            </div>
            <Switch
              aria-label="Include screenshot"
              checked={includeScreenshot}
              onCheckedChange={setIncludeScreenshot}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button>Send report</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
