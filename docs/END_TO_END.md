# End-to-End Product Flow

This document explains the full app lifecycle from setup context to interview analysis.

## Product Goal

Interview practice that feels realistic, psychologically grounded, and practical. The app helps users rehearse role-specific interviews and get direct, no-score feedback they can act on.

## Core Data Model

The app follows a top-down context model:

1. `UserProfile` (global context)
2. `RoleProfile` (role-specific context)
3. `InterviewAttempt` (per-session config, transcript, script, analysis)

All data is persisted in browser `localStorage` using a typed schema and migration-aware loader.

## Phase 1: Context Layer

### User flow

1. User enters onboarding.
2. Optional resume upload (PDF, DOCX, TXT).
3. Resume text is extracted browser-side.
4. App requests resume summary/autofill hints from AI.
5. User reviews and edits profile fields.
6. Profile is saved locally.
7. User creates role profiles with required title and optional context fields.

### System behavior

- Resume upload is optional and never blocks onboarding completion.
- Autofill is best-effort and always user-editable.
- Role data is text-first with no artificial size limits.
- Context is stored as modular, typed JSON under one local schema.

## Phase 2: Interview Mode

### User flow

1. User opens a role and creates an interview attempt.
2. User configures interview knobs (persona, follow-up intensity, length, category, notes).
3. App immediately generates and stores an interviewer script.
4. User starts interview.
5. Interview runs one question at a time.
6. User answers by speech-to-text and/or manual text entry.
7. Transcript is appended per turn and persisted continuously.
8. Interview ends when assistant returns the strict end token.

### System behavior

Two-stage AI pipeline:

1. Script Generation Agent
- Inputs: `UserProfile`, `RoleProfile`, `InterviewConfig`
- Output: reusable interviewer system prompt script
- Script includes pre-planned primary questions and follow-up policy

2. Interview Agent
- Inputs per turn: stored script + transcript
- Output per turn: next interviewer message or end token
- Maintains one-message-per-turn behavior and finite progression

## Phase 3: Analysis Mode

### User flow

1. Interview reaches end token.
2. Analysis generation starts automatically.
3. User receives structured post-interview report.
4. Report remains accessible in the saved attempt.

### Analysis output contract

- `impression_short`: 2-3 sentence summary
- `impression_long`: detailed paragraph
- `red_flags`: string list (can be empty)
- `top_improvement`: single highest-priority improvement

No scores or ratings are used.

## Persistence and Schema

- Storage key: `interview_ai_v1`
- Current schema version: `1`
- Migration strategy: safe parse and recover to empty store on invalid payloads
- Attempt records include:
- config
- script
- transcript
- analysis
- status and error context

## API Surface

- `POST /api/ai/resume`: resume summarization/autofill hints
- `POST /api/ai/script`: interviewer script generation
- `POST /api/ai/interview`: next-turn generation
- `POST /api/ai/analysis`: post-interview analysis generation

All API routes validate inputs, catch failures, and return clear error payloads.

## Reliability and Fallbacks

- Missing API key: app still renders and local workflows remain usable.
- Unsupported speech recognition: user can type answers manually.
- Resume parse failure: onboarding still continues with manual entry.
- Model output validation failures are surfaced with actionable messages.

## Design Intent

The product should feel calm and focused:

- low visual noise
- clear one-step interactions
- practical feedback that improves next interview behavior

