# commitly

Turn a GitHub repo into a structured learning path with hands-on tasks and tiny hints, so you learn by building.

## Why I built this

Tutorials tell you what to type. Docs tell you what exists. Neither teaches a real codebase. Commitly reads a repo and turns it into ordered tasks with just enough hint to keep you moving.

## How it works

Input: you paste a GitHub repo URL. The backend maps the repo structure, then generates a path of small tasks (read this file, change this function, add this test).

Human control: you do the work in your own editor. Hints stay short on purpose. Nothing auto-completes the task for you.

Risk I designed around: plausible but wrong generated tasks. The guardrail is grounding each task in the actual repo files plus a service layer (`repoService`) that pages components use for all API calls, so the frontend never invents endpoints.

## Quickstart

```sh
# frontend
cd commitly-frontend && npm install && npm run dev

# backend and landing have their own folders
# Supabase Edge Functions live in supabase/functions
```

Set `NEXT_PUBLIC_EDGE_API_BASE_URL` to your Supabase edge router in `.env.local`. Frontend config goes through `lib/config/env.ts`. Backend secrets stay server-side.

## Layout

```
commitly-frontend/   Next.js App Router dashboard
commitly-backend/    API and task generation
commitly-landing/    marketing page
supabase/            Edge Functions, migrations, seed
docs/                product notes
```

See `commitly-frontend/README.md` for frontend details.