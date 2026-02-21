# Poly Prompt Foundation

Minimal Next.js + TypeScript + Supabase Auth/Postgres starter.

## Quick local mode (no Supabase yet)

If Supabase env vars are not set, the app uses a local dev auth cookie so you can still:

- open `/login`
- sign in/sign up locally
- access `/dashboard`
- log out

Run with:

```bash
npm start
```

## 1) Create Supabase project

Copy your project values from Supabase:

- `Project URL`
- `anon public key`

## 2) Run DB SQL

In Supabase SQL Editor, run `sql/001_init.sql`.

## 3) Configure env vars

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4) Run app

```bash
npm install
npm run dev
```

Visit `http://localhost:3000/login`, sign up/sign in, then open `/dashboard`.
