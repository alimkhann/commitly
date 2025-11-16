"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GithubOAuthResult() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("status");

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/");
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-3xl border border-border bg-card/80 p-8 text-center shadow-xl">
        <h1 className="font-semibold text-2xl">
          GitHub connection {status === "success" ? "successful" : "updated"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          You can close this tab. We&apos;ll refresh your dashboard
          automatically.
        </p>
        <Button className="mt-6" onClick={() => router.push("/")}>
          Return home
        </Button>
      </div>
    </div>
  );
}
