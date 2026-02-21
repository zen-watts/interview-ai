# AGENTS.md

## Non-negotiable stack

- Next.js (App Router) + TypeScript

## Rules

- Keep secrets server-only (never expose service role keys).
- Avoid extra frameworks unless explicitly requested.
- Add a short top-of-file comment only when the file purpose is not obvious from its path/name.
- Add JSDoc for exported functions that touch auth, database, or external APIs (LLM calls), and for any non-trivial params/return shapes.
- Avoid redundant comments; comment only non-obvious logic and edge cases

## Agent Operating Style

- Collaborate first, then execute in full.
- For non-trivial work, propose a short plan with tradeoffs and a recommendation.
- Confirm alignment, then implement end-to-end without unnecessary pauses.
- Make game-time decisions when details are missing; do not block on minor ambiguity.
- Keep changes production-minded, scalable, and easy for the next engineer to extend.

## Architecture-First Expectations

- Think at the system level before editing code:
- Data contracts and types
- Storage schema and migration implications
- API boundaries and request/response shapes
- Failure paths and fallback behavior
- Favor clean module boundaries over clever shortcuts.
- Do not over-fragment the codebase; keep modules cohesive and practical.

## Logging Standards

- Logging is required for major state transitions, API calls, and failures.
- Logs must be human-readable, scannable, and consistent.
- Prefer a simple event shape: `module.event.phase` or `module.event.result`.
- Include useful context (ids, status, counts, durations) without leaking secrets or noisy payloads.
- On errors, include actionable context and the surfaced user-facing message path.

## Scope and Delivery Discipline

- Build what was asked, not adjacent wishlist features.
- If an assumption is needed, choose the most practical option and document it briefly.
- Keep graceful degradation in place (missing API key, unsupported browser APIs, failed parsing).
- Optimize for a clean v1 that runs, lints, builds, and is easy to iterate on.

## Documentation Expectations

- Keep docs concise, actionable, and non-fluffy.
- Update docs when behavior, architecture, or operating conventions change.
- Use these docs as primary context for future agents:
- `docs/END_TO_END.md`: product flow and data lifecycle
- `docs/BRAND.md`: design and voice system
- `docs/LOGGING.md`: logging conventions and examples
- `docs/ENGINEERING.md`: architecture and implementation notes
- `docs/REPORT.md`: implementation status and known gaps
