# Inner View

AI-mediated interview practice with a calm, editorial UI. The app builds interview context from profile + role + interview config, runs a turn-by-turn interview, and generates no-score post-interview analysis.

## Repo State

The original hackathon submission is preserved in the `hackathon-snapshot` branch and the `hackathon-final-submission` tag. `main` includes post-hackathon cleanup and improvements made after the event. For a fuller record of those changes, see `docs/post-hackathon-changes.md`.

## Stack

- Next.js App Router + TypeScript
- TailwindCSS
- React Context + hooks
- localStorage persistence (no auth, no DB)
- OpenAI via Next API routes
- Browser speech transcription (Web Speech API)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Fill `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.2
# Optional
# OPENAI_BASE_URL=
```

## Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Complete onboarding (optional resume upload: PDF/DOCX/TXT).
2. Create a role profile.
3. Create an interview attempt for that role.
4. Start interview, speak/type answers, and submit each turn.
5. Review transcript + analysis after interview completion.

## Developer Commands

- `npm run dev`: start dev server
- `npm start`: start dev server
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript checks
- `npm run build`: production build
- `npm run check`: lint + typecheck + build

## Docs

- `docs/END_TO_END.md`: product flow and lifecycle
- `docs/BRAND.md`: visual and voice system
- `docs/LOGGING.md`: logging conventions
- `docs/ENGINEERING.md`: architecture and implementation notes
- `docs/REPORT.md`: current status and known gaps

## Notes

- Without `OPENAI_API_KEY`, UI still works but AI calls fail with inline error messages.
- All data is local to the browser in localStorage, including scripts, transcripts, and analysis.
