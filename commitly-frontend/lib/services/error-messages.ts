const oauthErrorTranslationMap: Record<string, string> = {
  redirect_uri_mismatch: "github_oauth_error_redirect_uri_mismatch",
  invalid_state: "github_oauth_error_invalid_state",
  unauthorized_party: "github_oauth_error_unauthorized_party",
  missing_token: "github_oauth_error_missing_token",
  github_not_connected: "github_oauth_error_not_connected",
  oauth_callback_failed: "github_oauth_error_callback_failed",
};

export function getGithubOAuthErrorTranslationKey(code?: string | null) {
  return oauthErrorTranslationMap[code ?? ""] ?? "github_oauth_error_default";
}

export function mapGithubOAuthError(
  code?: string | null,
  fallback?: string,
  t?: (key: string, fallbackText?: string) => string
) {
  const translationKey = getGithubOAuthErrorTranslationKey(code);
  const translate = (key: string, defaultText: string) =>
    typeof t === "function" ? t(key, defaultText) : defaultText;
  switch (code) {
    case "redirect_uri_mismatch":
      return translate(
        translationKey,
        "GitHub OAuth callback URL is misconfigured. Verify the app callback URL in GitHub settings and your Supabase edge env."
      );
    case "invalid_state":
      return translate(
        translationKey,
        "GitHub sign-in state expired or is invalid. Start the connection flow again."
      );
    case "unauthorized_party":
      return translate(
        translationKey,
        "This domain is not authorized for your Clerk session. Reopen from app.commitly.one or update Clerk authorized parties."
      );
    case "missing_token":
      return translate(translationKey, "Sign in again before connecting GitHub.");
    case "github_not_connected":
      return translate(translationKey, "Connect GitHub first to generate roadmaps.");
    default:
      return fallback ?? translate(translationKey, "Unable to complete GitHub connection.");
  }
}
