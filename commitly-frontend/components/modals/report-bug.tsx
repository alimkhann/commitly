"use client";

import { useAuth } from "@clerk/nextjs";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { repoService } from "@/lib/services/repos";

type ReportBugProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ReportBug({ open, onOpenChange }: ReportBugProps) {
  const { getToken, isSignedIn } = useAuth();
  const { t } = usePreferences();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
      setSubmitError(t("bug_sign_in_required", "Sign in before sending a bug report."));
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (trimmedTitle.length < 6 || trimmedDescription.length < 15) {
      setSubmitError(
        t(
          "bug_validation_error",
          "Please provide a clearer title and reproduction details."
        )
      );
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
        setSubmitError(
          response.error ?? t("bug_submit_failed", "Failed to submit bug report.")
        );
        return;
      }
      setSubmitted(true);
      setTitle("");
      setDescription("");
      window.setTimeout(() => handleClose(false), 900);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("bug_submit_failed", "Failed to submit bug report.")
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
            <DialogTitle>{t("report_issue_title", "Report an issue")}</DialogTitle>
          </div>
          <DialogDescription>
            {t(
              "report_issue_desc",
              "Share what went wrong so we can reproduce and fix it quickly. Attaching screenshots or logs helps."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="bug-title">
              {t("title", "Title")}
            </label>
            <Input
              id="bug-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t(
                "bug_title_placeholder",
                "Streaming output stops after a few tokens"
              )}
              value={title}
            />
          </div>

          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="bug-description">
              {t("what_happened", "What happened?")}
            </label>
            <Textarea
              id="bug-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t(
                "bug_description_placeholder",
                "Steps to reproduce, expected result, actual outcome..."
              )}
              rows={6}
              value={description}
            />
          </div>

          <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
            {t(
              "bug_attach_hint",
              "Include links, screenshots, or logs directly in the description for now."
            )}
          </p>
          {submitError && <p className="text-destructive text-sm">{submitError}</p>}
          {submitted && (
            <p className="text-emerald-400 text-sm">
              {t(
                "bug_submitted",
                "Report submitted. Thank you for the detailed reproduction."
              )}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={() => handleClose(false)} variant="ghost">
            {t("cancel", "Cancel")}
          </Button>
          <Button disabled={isSubmitting} onClick={handleSubmit} type="button">
            {isSubmitting
              ? t("sending", "Sending...")
              : t("send_report", "Send report")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
