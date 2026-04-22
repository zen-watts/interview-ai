# Engineering Notes

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- OpenAI Responses API through Next route handlers
- Browser `localStorage` for persistence

## Current Architecture

The app is intentionally local-first. Product data lives in a typed client store and is persisted under one browser storage key. Server routes are used only for privileged or environment-backed work:

- resume parsing
- OpenAI requests
- optional interviewer TTS

## Data Model

Primary records:

- `UserProfile`
- `RoleProfile`
- `InterviewAttempt`

Each `InterviewAttempt` owns its config, generated script, transcript, analysis, status, and error state. Schema migration is handled in `src/lib/storage/schema.ts`.

## Runtime Flow

1. Onboarding saves a profile, optionally enriched from uploaded resume text.
2. A role is created and stored locally.
3. Creating an interview attempt immediately requests an interviewer script.
4. The live interview loop appends transcript turns locally and requests the next interviewer turn from `/api/ai/interview`.
5. Completion triggers analysis generation and stores the result back on the attempt.

## Design Constraints

- No auth or shared backend persistence yet.
- Secrets stay server-only in route handlers.
- The app should degrade cleanly when AI keys, TTS config, or browser speech APIs are unavailable.

## Notable Cleanup Decisions

- Root config stays minimal and only includes files that Next, TypeScript, Tailwind, PostCSS, ESLint, npm, or repo policy require.
- Helper automation belongs in `scripts/`.
- Long-form notes and project write-ups belong in `docs/`.
- Unused static assets and generated artifacts should not live in the repo root.
