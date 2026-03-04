"use client";

import { useAuth } from "@clerk/nextjs";
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
import { repoService } from "@/lib/services/repos";

type ReportBugProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ReportBug({ open, onOpenChange }: ReportBugProps) {
  const { getToken, isSignedIn } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSubmitError(null);
      setSubmitted(false);
    }
  };

  const handleSubmit = async () => {
    if (!isSignedIn) {
      setSubmitError("Sign in before sending a bug report.");
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (trimmedTitle.length < 6 || trimmedDescription.length < 15) {
      setSubmitError("Please provide a clearer title and reproduction details.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitted(false);
    try {
      const token = (await getToken?.()) ?? undefined;
      const response = await repoService.submitBugReport(
        {
          title: trimmedTitle,
          description: trimmedDescription,
          routePath: typeof window !== "undefined" ? window.location.pathname : "",
          userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "",
        },
        token
      );
      if (!response.ok) {
        setSubmitError(response.error ?? "Failed to submit bug report.");
        return;
      }
      setSubmitted(true);
      setTitle("");
      setDescription("");
      window.setTimeout(() => handleClose(false), 900);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit bug report."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={handleClose} open={open}>
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
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Streaming output stops after a few tokens"
              value={title}
            />
          </div>

          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="bug-description">
              What happened?
            </label>
            <Textarea
              id="bug-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Steps to reproduce, expected result, actual outcome..."
              rows={6}
              value={description}
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
            <Button disabled size="sm" variant="outline">
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
          <p className="text-muted-foreground text-xs">
            File upload is coming next. For now, include links in the
            description if needed.
          </p>
          {submitError && <p className="text-destructive text-sm">{submitError}</p>}
          {submitted && (
            <p className="text-emerald-400 text-sm">
              Report submitted. Thank you for the detailed repro.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={() => handleClose(false)} variant="ghost">
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={handleSubmit} type="button">
            {isSubmitting ? "Sending..." : "Send report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
