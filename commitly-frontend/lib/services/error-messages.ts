export function mapGithubOAuthError(code?: string | null, fallback?: string) {
  switch (code) {
    case "redirect_uri_mismatch":
      return "GitHub OAuth callback URL is misconfigured. Verify the app callback URL in GitHub settings and your Supabase edge env.";
    case "invalid_state":
      return "GitHub sign-in state expired or is invalid. Start the connection flow again.";
    case "unauthorized_party":
      return "This domain is not authorized for your Clerk session. Reopen from app.commitly.one or update Clerk authorized parties.";
    case "missing_token":
      return "Sign in again before connecting GitHub.";
    case "github_not_connected":
      return "Connect GitHub first to generate roadmaps.";
    default:
      return fallback ?? "Unable to complete GitHub connection.";
  }
}
