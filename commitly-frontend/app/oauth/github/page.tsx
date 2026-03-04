"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { mapGithubOAuthError } from "@/lib/services/error-messages";

function GithubOAuthResultContent() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("status");
  const errorCode = params.get("error");
  const detail = params.get("detail");
  const isError = status === "error";
  const title = isError
    ? "GitHub connection failed"
    : status === "success"
      ? "GitHub connection successful"
      : "GitHub connection updated";

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/");
    }, isError ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [isError, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-border/70 bg-[#0d1117] p-8 text-center shadow-xl">
        <h1 className="font-semibold text-2xl">{title}</h1>
        {isError ? (
          <p className="mt-3 text-muted-foreground text-sm">
            {mapGithubOAuthError(errorCode, detail ?? undefined)}
          </p>
        ) : (
          <p className="mt-3 text-muted-foreground">
            You can close this tab. We&apos;ll refresh your dashboard
            automatically.
          </p>
        )}
        <Button className="mt-6" onClick={() => router.push("/")}>
          Return home
        </Button>
      </div>
    </div>
  );
}

export default function GithubOAuthResult() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GithubOAuthResultContent />
    </Suspense>
  );
}
