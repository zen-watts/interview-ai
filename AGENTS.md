# AGENTS.md

## Non-negotiable stack

- Next.js (App Router) + TypeScript

## Rules

- Keep secrets server-only (never expose service role keys).
- Avoid extra frameworks unless explicitly requested.
- Add a short top-of-file comment only when the file purpose is not obvious from its path/name.
- Add JSDoc for exported functions that touch auth, database, or external APIs (LLM calls), and for any non-trivial params/return shapes.
- Avoid redundant comments; comment only non-obvious logic and edge cases
