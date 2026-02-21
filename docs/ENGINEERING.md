# Engineering Notes

## Architecture

The app is organized around three product phases:

1. Context phase
- `UserProfile` (global)
- `RoleProfile` (per role)
- `InterviewAttempt` config (per session)
- Script generation API creates and stores interviewer script in attempt

2. Interview phase
- Turn loop uses stored script + transcript
- Browser speech recognition fills editable text input
- Each user submit appends transcript and requests next interviewer turn
- END token (`<INTERVIEW_END>`) ends interview flow

3. Analysis phase
- Analysis API consumes script + full transcript
- Returns required no-score JSON format
- Analysis is stored on attempt and rendered in UI

## Key Directories

- `app/`: App Router pages and API routes
- `app/api/ai/*`: script/interview/analysis/resume endpoints
- `src/components/`: onboarding, home, role, interview, ui, providers
- `src/lib/ai/`: OpenAI client, prompts, schemas, API helpers
- `src/lib/storage/`: typed localStorage schema, migrations, persistence
- `src/lib/logger/`: small structured logger
- `src/lib/utils/`: id/time/resume parsing helpers
- `src/lib/theme/`: centralized theme tokens

## State and Persistence

Global store is managed by `AppStoreProvider` with typed CRUD methods and automatic localStorage persistence.

Storage key: `interview_ai_v1`
Schema version: `1`

Current persisted shape:

- `profile`: `UserProfile | null`
- `roles`: `RoleProfile[]`
- `attempts`: `InterviewAttempt[]`

Each attempt stores:

- config knobs
- generated script
- full transcript (assistant/user turns)
- analysis result
- status + lastError

## Schema and Migrations

`src/lib/storage/schema.ts` defines:

- `CURRENT_SCHEMA_VERSION`
- zod runtime schema for v1
- `migrateToCurrentSchema(raw)`

Migration behavior today:
- unknown/invalid payloads reset to empty v1 store
- v1 valid payloads load directly

## Prompting

Prompts are centralized in `src/lib/ai/prompts/*`:

- `script-generation.ts`
- `interview.ts`
- `analysis.ts`
- `resume.ts`

Design choices:

- Script generation pre-plans primary questions and behavior policy.
- Interview prompt enforces one-question turns and END token handling.
- Analysis prompt enforces strict JSON output and no numeric scoring.

## Logging

`createLogger(module)` provides `debug/info/warn/error` with consistent prefixing.
Used across:

- client store/actions
- client API calls
- resume parsing
- server API routes

## Assumptions and Product Decisions

- No deletion flows in v1 (create/edit only).
- No starred-question feature (explicitly removed).
- "Unhinged" mode remains playful but interview-relevant and professional.
- `npm start` runs dev server for faster local onboarding.

## Error Handling

- All API calls are wrapped with explicit error parsing.
- Inline UI notices surface failures without crashing flow.
- Speech recognition unsupported: manual typing remains fully usable.
- Interview turn route includes a finite-turn guard to avoid runaway loops.
