# Logging Conventions

This project uses extensive logging, but logs should read like clear product events for humans, not internal debug codes.

## Principles

- Log important behavior, not everything.
- Make logs easy to scan under pressure.
- Keep message structure consistent across client and server.
- Include context that helps debugging without exposing secrets.
- Prefer plain-language messages over technical shorthand.

## Message Style

Write logs like short status updates:

- `User profile saved.`
- `Loaded app data from local storage.`
- `Interview script generated successfully.`
- `Interview analysis request failed.`

Avoid style like:

- `request.script.success`
- `store.persist.success`
- `api.analysis.response.empty`

## Required Context Fields

Include fields that help answer:

1. What happened?
2. Where did it happen?
3. Which record/session was involved?
4. What was the outcome?

Common context keys:

- `attemptId`
- `roleId`
- `responseId`
- `status`
- `durationSeconds`
- `transcriptLength`
- `message`
- `hasProfile`
- `questionCount`

## Readability Rules

- Keep messages short and precise.
- Keep payloads shallow and compact.
- Prefer stable key names across modules.
- Use `info` for lifecycle milestones, `debug` for deep traces, `warn` for recoverable issues, `error` for failures.

## Safety Rules

- Never log API keys, tokens, or raw secret values.
- Avoid dumping full resume text or full transcripts in normal logs.
- On errors, log safe summaries and identifiers, not sensitive payloads.

## Client vs Server Guidance

Client logs:

- UI transitions
- user-triggered actions
- request start and finish status
- recoverable UX fallbacks

Server logs:

- request validation outcomes
- model call outcomes
- parse/contract failures
- response status and key identifiers

## Recommended Pattern

1. Log start.
2. Log success with key outputs and counts.
3. Log failure with safe message and useful identifiers.
4. Surface clear user-facing message separately from technical details.

## Example Logs

- `[InterviewAI] [INFO] store-provider: User profile saved.`
- `[InterviewAI] [INFO] client-ai: Interview script generated.`
- `[InterviewAI] [WARN] onboarding: Resume text was extracted but is too short for reliable autofill.`
- `[InterviewAI] [ERROR] api.analysis: Interview analysis request failed.`
