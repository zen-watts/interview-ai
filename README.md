# Poly Prompt Foundation

Minimal Next.js + TypeScript starter with local browser-storage auth.

## Run locally (no remote database required)

```bash
npm install
npm start
```

Then open `http://localhost:3000/login`.

## Current auth behavior

- Login stores email in a local browser cookie (`dev_auth_email`)
- `/dashboard` requires that cookie
- `/logout` clears that cookie and redirects to `/login`

## Later: add Supabase

Supabase helper files and SQL are still included for later integration:

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `sql/001_init.sql`
