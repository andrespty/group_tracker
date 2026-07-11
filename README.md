# Tally — group tracker

A tiny web app for tracking a shared count with friends (drinks, km, dollars…) toward a goal.
React + Vite frontend, Supabase (Postgres) backend. No servers to run. Free to start.

## How it works

- **Public read, token-gated write.** The Supabase anon key is public, so all
  tables are locked by RLS and every operation goes through `SECURITY DEFINER`
  functions in `schema.sql`. Viewing a board needs the group's `view_token`
  (it's in the share link). Logging an entry needs a member's `write_token`.
- **Guests + optional accounts.** Anyone with a link can join and log as a guest.
  Signing in (magic link) just lets you see all your trackers in one place and
  "claim" your guest history.

## 1. Set up Supabase (free tier)

1. Create a project at https://supabase.com (free).
2. Open **SQL Editor**, paste all of `schema.sql`, and run it.
3. Go to **Project Settings → API** and copy the **Project URL** and **anon public** key.
4. (Auth → optional) Magic links work out of the box. For real email delivery,
   confirm your email provider settings; for local testing the link appears in
   **Auth → Logs**.

## 2. Run the app

```bash
cp .env.example .env      # then paste your URL + anon key into .env
npm install
npm run dev               # http://localhost:5173
```

## 3. Deploy (free)

`npm run build` produces a static `dist/` folder. Host it free on Cloudflare
Pages or Vercel — set the two `VITE_…` env vars in the dashboard. Cost stays
$0 until real traffic; the first paid Supabase tier is ~$25/mo and covers far
more than a friend group.

## 4. One-tap iOS Shortcut (per person)

Open a tracker in the app — the **Share** panel shows your `endpoint` and
`write_token`. Build a Shortcut once:

1. Shortcuts app → **+** → add action **Get Contents of URL**.
2. **URL**: the endpoint shown, e.g. `https://YOURPROJECT.supabase.co/rest/v1/rpc/log_entry`
3. **Method**: `POST`
4. **Headers** (two):
   - `apikey` = your Supabase **anon** key
   - `Content-Type` = `application/json`
5. **Request Body**: `JSON` with one field:
   - `p_write_token` = your `write_token`
   (leave `p_amount` out to use the tracker's default increment; add it as a
   Number to log a custom amount.)
6. Name it ("+1 drink"), add to Home Screen for one-tap logging.

Each person makes their own Shortcut with their own `write_token`. New tracker
later = create it in the app, share the link, swap the token. No Google Sheet,
no AppScript, ever.

## Data model

`groups` (name, unit, increment, goal, view_token) ·
`members` (name, write_token, optional account_id) ·
`entries` (group, member, amount, time). Leaderboard = `sum(amount)` per member.
