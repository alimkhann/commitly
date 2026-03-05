# Clerk Production Key Runbook

## Goal
Move Commitly from Clerk test credentials to production credentials safely.

## Required Environment Variables
Set these for production deployments:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_...`
- `CLERK_SECRET_KEY` = `sk_live_...`
- `CLERK_JWKS_URL` = Clerk JWKS endpoint for your prod instance
- `CLERK_ISSUER` = Clerk issuer URL for your prod instance
- `CLERK_AUDIENCE` = expected JWT audience used by Supabase Edge
- `CLERK_AUTHORIZED_PARTIES` = comma-separated allowed origins

Recommended parties during transition:

- `https://app.commitly.one`
- `https://commitly-frontend.vercel.app`

## Clerk Dashboard Checklist
1. Create/verify production Clerk instance.
2. Add production domains (`app.commitly.one`, fallback domain if still needed).
3. Configure JWT template used by Supabase Edge:
   - include `aud` claim matching `CLERK_AUDIENCE`
   - include `planTier` claim (`free|pro|ultra`)
4. Configure social OAuth providers on the **production** Clerk instance.
   - Google:
     - Authorized JavaScript origin: `https://app.commitly.one`
     - Authorized redirect URI: `https://clerk.commitly.one/v1/oauth_callback`
   - GitHub OAuth App:
     - Homepage URL: `https://app.commitly.one`
     - Authorization callback URL: `https://clerk.commitly.one/v1/oauth_callback`
   - Apple Sign in:
     - Return URL: `https://clerk.commitly.one/v1/oauth_callback`
5. If social OAuth returns `missing client_id` or `invalid OAuth client request`, re-check provider client ID/secret in Clerk social connections first.

## Supabase Edge Checklist
1. Set `CLERK_JWKS_URL`, `CLERK_ISSUER`, `CLERK_AUDIENCE`, `CLERK_AUTHORIZED_PARTIES`.
2. Deploy functions.
3. Test `/api/v1/auth/ping` with a production session token.

## Frontend Verification
1. Open `https://app.commitly.one`.
2. Confirm no Clerk dev-key warning banner appears.
3. Sign in and verify:
   - dashboard loads
   - GitHub connect works
   - roadmap generate starts and progresses

## Rollback
If auth breaks after rotation:
1. Restore previous env values in Vercel/Supabase.
2. Redeploy frontend and edge functions.
3. Re-run auth ping and GitHub OAuth callback checks.
