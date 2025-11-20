import { apiClient } from "@/lib/api/client";
import { env } from "@/lib/config/env";

export type GithubStatusResponse = {
  connected: boolean;
  github_login?: string | null;
  avatar_url?: string | null;
};

export type OAuthStartResponse = {
  authorize_url: string;
};

export const githubService = {
  status(authToken?: string) {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        data: null,
        error: "API base URL missing",
      });
    }
    return apiClient<GithubStatusResponse>(env.apiBaseUrl, {
      path: "/api/v1/github/oauth/status",
      authToken,
    });
  },
  start(authToken?: string, returnTo?: string) {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        data: null,
        error: "API base URL missing",
      });
    }
    return apiClient<OAuthStartResponse>(env.apiBaseUrl, {
      path: "/api/v1/github/oauth/start",
      method: "POST",
      body: returnTo ? { return_to: returnTo } : {},
      authToken,
    });
  },
  disconnect(authToken?: string) {
    if (!env.apiBaseUrl) {
      return Promise.resolve({
        ok: false,
        status: 0,
        data: null,
        error: "API base URL missing",
      });
    }
    return apiClient(env.apiBaseUrl, {
      path: "/api/v1/github/oauth/token",
      method: "DELETE",
      authToken,
    });
  },
};

export type GithubService = typeof githubService;
