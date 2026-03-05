# Commitly Frontend

Commitly’s dashboard app built with the Next.js App Router, Tailwind CSS, and TypeScript.

## Project structure

```
app/                // App Router routes, layouts, and pages
components/         // Shared UI primitives + layout/navigation building blocks
data/               // Static seed data used while the backend is under construction
lib/
  api/              // Edge route handlers that proxy chat/history requests
  config/           // Environment helpers (API base URL, Supabase, Clerk keys)
  services/         // Domain-level accessors (e.g. repoService)
public/             // Static assets
styles/             // Global Tailwind layer
```

## Environment variables

Next.js follows the [official environment-variable guidance](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables). Configure everything that needs to be exposed to the browser with the `NEXT_PUBLIC_` prefix:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_EDGE_API_BASE_URL` | Supabase Edge base URL (e.g. `https://<project>.supabase.co/functions/v1/api-v1`) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Used once Supabase client wiring lands |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Enables Clerk’s frontend SDK |

Add backend-only secrets (Supabase service key, Clerk secret key, Stripe billing keys, etc.) to `.env.local` without the prefix and read them in Edge Functions or dedicated server-only scripts.

## Development scripts

```bash
npm install          # install deps
npm run dev          # start Next.js on http://localhost:3700
npm run lint         # Next.js ESLint rules + Tailwind-aware Stylelint
```

## Backend readiness

- `lib/config/env.ts` centralizes all browser-safe configuration so components never read from `process.env` directly.
- `lib/api/client.ts` is the single fetch helper that applies consistent headers, caching, and error handling.
- `lib/services/repos.ts` exposes `repoService`, which pages/components use for all `/api/v1/*` calls to the Supabase edge router.
- The new ESLint rule prevents UI code from bypassing the service layer, keeping the future API seam clean.

## Edge integration notes

1. Set `NEXT_PUBLIC_EDGE_API_BASE_URL` to your Supabase edge router (`.../functions/v1/api-v1`).
2. Clerk JWTs are forwarded from the frontend and verified in edge handlers.
3. `repoService.generateRoadmap` posts to `/api/v1/roadmap/generate` after GitHub OAuth under `/api/v1/github/oauth/*`.
4. The home page reads `/api/v1/usage/global` to show shared token pool status.
