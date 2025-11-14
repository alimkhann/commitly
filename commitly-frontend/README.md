# Commitly Frontend

Commitly’s marketing/learning experience built with the Next.js App Router, Tailwind CSS, and TypeScript. The visual copy/layout matches the design system exactly – restructuring focused on project hygiene, not UI changes.

## Project structure

```
app/                // App Router routes, layouts, and pages
components/         // Shared UI primitives + layout/navigation building blocks
data/               // Static seed data used while the backend is under construction
lib/
  api/              // Fetch helpers that know how to talk to the FastAPI backend
  config/           // Environment helpers (API base URL, Supabase, Clerk keys)
  services/         // Domain-level accessors (e.g. repoService)
public/             // Static assets
styles/             // Global Tailwind layer
```

## Environment variables

Next.js follows the [official environment-variable guidance](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables). Configure everything that needs to be exposed to the browser with the `NEXT_PUBLIC_` prefix:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | FastAPI gateway URL (e.g. `https://api.commitly.dev`) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Used once Supabase client wiring lands |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Enables Clerk’s frontend SDK |

Add backend-only secrets (Supabase service key, Clerk secret key, Stripe billing keys, etc.) to `.env.local` without the prefix and read them inside the FastAPI project or dedicated server-only scripts.

## Development scripts

```bash
npm install          # install deps
npm run dev          # start Next.js on http://localhost:3700
npm run lint         # Next.js ESLint rules + Tailwind-aware Stylelint
```

## Backend readiness

- `lib/config/env.ts` centralizes all browser-safe configuration so components never read from `process.env` directly.
- `lib/api/client.ts` is the single fetch helper that applies consistent headers, caching, and error handling.
- `lib/services/repos.ts` exposes `repoService`, which pages/components now use instead of importing from `data/`. Today it proxies to the static fixtures, but it already knows how to queue repo imports against the FastAPI backend (it gracefully skips the network call when `NEXT_PUBLIC_API_BASE_URL` is not set).
- The new ESLint rule prevents UI code from bypassing the service layer, keeping the future API seam clean.

## FastAPI integration game plan

1. **Expose REST endpoints** such as `POST /roadmap/generate`, `GET /repos/:id`, and `GET /repos` from FastAPI. Attach Supabase from the backend for persistence and Clerk webhooks for identity.
2. **Configure auth**: Clerk issues JWTs; validate them in FastAPI (Clerk publishes the JWKS). Return Clerk user IDs to map workspaces/billing in Supabase.
3. **Billing**: Use Clerk’s built-in Stripe portal or call Stripe from FastAPI. Store subscription state in Supabase and surface it via `/billing` endpoints.
4. **Wire the frontend**: set `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, etc. `repoService.generateRoadmap` posts to `/roadmap/generate` after the user connects GitHub through the OAuth flow that lives under `/github/oauth/*` endpoints.
5. **Secure data fetching**: when you add authenticated pages, hydrate Clerk on the client and forward the session token via `fetch` headers inside the service layer. Supabase client helpers can also live in `lib/services` so every request gets the same auth context.
