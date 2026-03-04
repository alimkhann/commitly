"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";

import { Button } from "@/components/ui/button";
import { mapGithubOAuthError } from "@/lib/services/error-messages";

function GithubOAuthResultContent() {
  const { t } = usePreferences();
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("status");
  const errorCode = params.get("error");
  const detail = params.get("detail");
  const isError = status === "error";
  const title = isError
    ? t("github_connection_failed", "GitHub connection failed")
    : status === "success"
      ? t("github_connection_success", "GitHub connection successful")
      : t("github_connection_updated", "GitHub connection updated");

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/");
    }, isError ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [isError, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-border/70 bg-card p-8 text-center shadow-xl">
        <h1 className="font-semibold text-2xl">{title}</h1>
        {isError ? (
          <p className="mt-3 text-muted-foreground text-sm">
            {mapGithubOAuthError(errorCode, detail ?? undefined, t)}
          </p>
        ) : (
          <p className="mt-3 text-muted-foreground">
            {t(
              "github_oauth_success_body",
              "You can close this tab. We'll refresh your dashboard automatically."
            )}
          </p>
        )}
        <Button className="mt-6" onClick={() => router.push("/")}>
          {t("return_home", "Return home")}
        </Button>
      </div>
    </div>
  );
}

export default function GithubOAuthResult() {
  return (
    <Suspense fallback={<div className="sr-only" />}>
      <GithubOAuthResultContent />
    </Suspense>
  );
}
