# AGENTS.md

## Non-negotiable stack

- Next.js (App Router) + TypeScript
- Supabase Postgres (database)
- Supabase Auth (authentication)

## Rules

- Keep secrets server-only (never expose service role keys).
- Avoid extra frameworks unless explicitly requested.
- Keep changes small, and keep main deployable.
