# TradeLens

An AI-powered trade journal. Upload a chart screenshot and it automatically detects
instrument, direction, entry/exit/stop/target, support/resistance, trend, and bias —
then logs the trade for you. No manual entry beyond the upload itself.

Everything below is free.

## 1. Create a Supabase project (free) — this is your database + login system

1. Go to https://supabase.com, sign up, click "New project"
2. Once it's created, go to **SQL Editor** → New query → paste the contents of
   `supabase-schema.sql` from this folder → Run
3. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key

## 2. Get a free Gemini API key — this powers the chart analysis

1. Go to https://aistudio.google.com
2. Sign in with Google → click "Get API key" → "Create API key"
3. Copy the key (free tier: generous daily limit, no card required)

## 3. Set up your environment variables

Copy `.env.local.example` to `.env.local` and fill in the three values you just copied:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...
```

## 4. Run it locally (optional, to test first)

```
npm install
npm run dev
```

Open http://localhost:3000

## 5. Deploy for free on Vercel

1. Push this folder to a GitHub repo (or use Vercel's CLI/drag-and-drop deploy)
2. Go to https://vercel.com, sign up, "Add New Project", import the repo
3. In the project's **Environment Variables** settings, add the same three variables
   from step 3 (do NOT commit `.env.local` — it's already in `.gitignore`)
4. Deploy — you'll get a live URL like `tradelens-yourname.vercel.app`

That's it — you now have a real, hosted app with real sign-in, for $0/month at
personal-use volume (both Supabase and Gemini have generous free tiers).

## What's intentionally NOT included yet

Live trade execution to MT4/MT5 is not built here. That's a separate, higher-stakes
phase — it needs a broker bridge (e.g. MetaApi.cloud) and should only be added once
you trust the AI's chart reads from real-world use, with a manual confirm step before
any order is placed. Ask Claude when you're ready to scope that phase.
