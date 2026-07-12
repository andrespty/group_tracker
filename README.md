# Tally — group tracker

## What this app is

Tally is a shared group tracker. Friends log entries — drinks, kilometers,
dollars, whatever — toward a shared goal, and watch the total climb together.
It's a React + Vite frontend talking to a Supabase (Postgres) backend, built
to be deployed as a static site with no server of your own to run or pay for.

## How it works (the mental model)

**Public read, token-gated write.** There's no login required to view or
participate in a tracker. Instead, two random tokens do the access control:

- A group's `view_token` (embedded in its share link) is all you need to
  *see* the board.
- A member's `write_token` is what lets *that specific person* log an entry.

Every Postgres table (`groups`, `members`, `entries`) has Row Level Security
turned on with **no policies**, which in Postgres means "nobody gets in
directly — not even with the public API key." The only way in is through a
set of Postgres functions (`create_group`, `log_entry`, `get_standings`, and
so on, defined in `supabase/migrations/`) marked `security definer`. Those
functions run with elevated privileges but check the token you pass in by
hand before doing anything. This is the entire security model — read it as
"the database is the API," not "the database is a data store behind an API."

**Guests vs. accounts.** Anyone with a link can join and log entries as a
guest — no signup. Optionally signing in with a magic link doesn't unlock any
new *capability*; it just groups your trackers together on one dashboard and
lets you "claim" a guest membership so your history follows your account
across devices.

**The key that ships in the browser is meant to ship in the browser.** The
frontend uses Supabase's anon / publishable key (`VITE_SUPABASE_ANON_KEY`),
which is safe to expose — it's constrained by the RLS + `security definer`
setup above. Supabase also issues a **secret key** (sometimes shown as
`service_role`) which bypasses RLS entirely. That key must **never** appear
in this app's code, env files, or bundle. This app has no legitimate use for
it.

## The two databases (the concept that trips people up)

There are two separate, independent Supabase Postgres databases involved in
this project:

1. **LOCAL** — runs on your machine in Docker, managed by the Supabase CLI.
   It's disposable: you can wipe and rebuild it in seconds, and nothing you
   do to it matters to anyone else. This is where you develop.
2. **CLOUD** — the real hosted Supabase project. It has real data from real
   people. You only ever update it on purpose, by running `supabase db
   push`.

The schema — every table and function — is defined as a series of files in
[`supabase/migrations/`](supabase/migrations), and that folder is committed
to git. That's the important part: **the schema travels with the code.**
Check out an older branch and the migration files for that point in history
come with it; the local database is meant to be rebuilt from whatever
migrations are on disk right now.

The one rule that keeps this whole system honest: **never edit the schema by
hand in the Supabase Studio dashboard (local or cloud).** A hand-made change
doesn't exist as a file, so it isn't in git, doesn't travel with a branch,
and puts the migration history out of sync between LOCAL and CLOUD (and
between your machine and anyone else's). Every schema change is a new file
in `supabase/migrations/`, created the way described below.

## First-time setup on a new machine

**Prerequisites:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), running
  (the local Supabase stack is a set of Docker containers)
- The Supabase CLI: `brew install supabase/tap/supabase`
- Node.js

Then, from the project root:

```bash
npm install

# Log the CLI into your Supabase account (opens a browser to authenticate).
supabase login

# Connect this local checkout to your actual cloud project. You need this
# so `supabase db push` later knows where "cloud" is. Find <ref> in the
# Supabase dashboard: Settings → General → Reference ID (it's also the
# subdomain of your project's URL, https://<ref>.supabase.co).
supabase link --project-ref <ref>

# Start the local Supabase stack (Postgres, the API, Studio, etc.) in Docker.
supabase start

# Build the local database from every file in supabase/migrations/, in order.
supabase db reset

npm run dev
```

`supabase start` prints a block of URLs and keys — you can also get them
again any time with `supabase status`. You want the **API URL** and the
**anon key** (Supabase's newer dashboards/CLI output call this the
"publishable key" — same thing). Put them in `.env.local` as described next.

## Environment files

Vite decides which env file(s) to load based on the `--mode` flag (`npm run
dev` implies `development`, `npm run dev:cloud` below uses `cloud`). For a
given mode it loads, in increasing priority (later overrides earlier):

```
.env                  → always loaded
.env.local            → always loaded, gitignored
.env.<mode>           → only loaded in that mode
.env.<mode>.local     → only loaded in that mode, gitignored
```

In practice, this project uses two files, and you only need to think about
which one is "active":

- **`.env.local`** — your LOCAL Supabase values. This is what `npm run dev`
  picks up by default, since there's no `.env.<mode>` for the default
  `development` mode to add on top.
- **`.env.cloud`** — your CLOUD Supabase values. Only loaded when you
  explicitly run in `cloud` mode (see below) — and since `.env.<mode>` beats
  `.env.local` in priority, it safely overrides it for that run.

Both are gitignored on purpose — they're per-machine, and `.env.cloud` in
particular holds credentials for the real database.

Each file needs the same two variables:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321        # or https://<ref>.supabase.co for cloud
VITE_SUPABASE_ANON_KEY=...                       # the anon / publishable key, never the secret key
```

Vite only reads env files when its dev server starts up — if you edit one
while `npm run dev` is running, restart it.

**Running against cloud from your machine:**

```bash
npm run dev:cloud
```

This runs `vite --mode cloud`, which loads `.env.cloud` on top of
`.env.local`. ⚠️ **This talks to the real, live database.** Anything you
create, log, rename, or delete while running this happens for real, to
everyone using that tracker. Use it to debug a cloud-specific issue, not as
your default way of developing.

## Everyday workflows

### 1. Normal development

```bash
supabase start
npm run dev
```

You're now developing against LOCAL — safe to break, safe to hammer with
test data.

### 2. Changing the schema

```bash
supabase migration new add_something_or_other
```

This creates an empty, timestamped file in `supabase/migrations/`. Write
your SQL in it (new table, new column, new or changed function — whatever
you need), then rebuild local from scratch to make sure it actually works:

```bash
supabase db reset
```

`db reset` doesn't just apply your new file — it wipes LOCAL and replays
*every* migration in the folder, in order, from an empty database. That's
what makes it a real test: it proves your change works as part of the full
history, not just on top of whatever state your local database happened to
already be in.

Then test in the app (`npm run dev`) or poke at the tables directly in
Studio (see Gotchas below for the URL).

**Never edit a migration file that's already been pushed to cloud.** Once
`supabase db push` has run a file against the real database, Postgres
considers it "applied" and won't run it again — editing the file after the
fact only changes what LOCAL sees, silently diverging the two databases.
If you need to change something, write a new migration that alters or fixes
what the old one did.

### 3. Switching git branches

```bash
git checkout some-other-branch
supabase db reset
```

Checking out a branch changes which files are sitting in
`supabase/migrations/`, but it doesn't touch your already-running local
database. Run `db reset` afterward so LOCAL is rebuilt from *this* branch's
migrations and actually matches what the code on this branch expects.

### 4. Shipping to cloud

```bash
git checkout main
git pull
supabase db reset      # confirm the full history still builds clean, locally, before touching real data
supabase db push       # apply any migrations cloud doesn't have yet
```

### 5. Stopping

```bash
supabase stop
```

Stops the local Docker containers. Your data is kept in a Docker volume and
comes back next time you run `supabase start` — it's not wiped unless you
pass `--no-backup`.

## Gotchas

A running list of things that have actually gone wrong.

**`function gen_random_bytes(integer) does not exist`**
Token generation uses Postgres's `pgcrypto` extension. On Supabase, that
extension lives in a schema called `extensions`, not `public` — so a
function that only sets `search_path = public` can fail to find it. Any
function using `pgcrypto` needs `set search_path = extensions, public` in
its definition (see `_new_token()` in the migrations for the pattern). The
annoying part: this can pass on LOCAL and fail on CLOUD (or vice versa) if
the two environments' default search paths differ — which is exactly why
step 4 above always verifies with `db reset` *and* `db push` rather than
trusting one or the other.

**`could not create unique index ... is duplicated`**
This means the CLOUD database already has real rows that violate the unique
constraint your new migration is trying to add (for example, two members in
the same group somehow ended up with the same name). Migrations run against
real, existing data, not a blank slate. Go clean up the offending rows by
hand in the SQL Editor first, then run `supabase db push` again.

**`db push` says a migration is already applied / objects already exist**
Supabase tracks which migrations it's already run in a history table. If
that table's record disagrees with reality (e.g. someone applied a change
by hand, or a push was interrupted), tell it the truth:

```bash
supabase migration repair --status applied <timestamp>
```

where `<timestamp>` is the leading number in the migration's filename.

**`supabase db pull` reports "No schema changes found"**
Don't lean on `db pull` to generate migrations for you — it diffs and can
easily miss things or report nothing changed when something did. Write
migration SQL by hand, as in workflow 2 above.

**Local Studio shows no tables / looks empty**
Studio is at **http://127.0.0.1:54323** when the local stack is running.
If your tables aren't there, double-check the schema dropdown in the table
editor is set to `public` (it's easy to land on a different schema), and
hard-refresh the page — Studio's UI state can get stale after a
`db reset`.

## Deploying the frontend

```bash
npm run build
```

produces a static `dist/` folder — no server-side rendering, nothing to
run. Host it for free on Cloudflare Pages or Vercel; set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the **cloud** values) as
environment variables in the host's dashboard.

Then, in the Supabase dashboard, go to **Authentication → URL
Configuration → Redirect URLs** and add your deployed URL. Magic-link
sign-in emails link back to whatever's on that allow-list — skip this and
sign-in will silently fail to redirect after someone clicks the email link.

## iOS Shortcut (one-tap logging)

Every tracker has a **Log from phone** tab with your personal `write_token`
already filled in — this walks through the same steps:

1. Shortcuts app → **+** → add action **Get Contents of URL**.
2. **URL**: the log entry endpoint, `<SUPABASE_URL>/rest/v1/rpc/log_entry`.
3. **Method**: `POST`.
4. **Headers** (add two):
   - `apikey` = your Supabase anon / publishable key
   - `Content-Type` = `application/json`
5. **Request Body**: `JSON`, with one field, `p_write_token` = your
   `write_token`. Leave `p_amount` out to use the tracker's default
   increment.
6. Name it (e.g. "+1 drink") and add it to your Home Screen.

Each person builds their own Shortcut with their own `write_token` — that
token is what identifies them as that specific member when the request
comes in.

## Project structure

```
src/
  main.jsx                    entry point — mounts <App/>, imports theme + component CSS
  App.jsx                     shell: theme toggle, session, routing between Home and a tracker
  routes.jsx                  reads/writes the ?g= view_token in the URL

  lib/                        no React, no imports from features/ — plain helpers + the API layer
    supabase.js                the Supabase client
    api.js                     one function per Postgres RPC call
    tokens.js                  localStorage-backed store of your write_tokens, keyed by view_token
    format.js                  number/date formatting, name initials, URL helpers
    colors.js                  per-member color assignment
    confetti.js                the little celebration burst on logging

  components/                 generic, reusable UI — Card, Button, Field, Avatar, Tabs

  theme/                      tokens.css (colors/spacing as CSS variables) + base.css (reset) + useTheme.js

  styles/
    components.css             all the component-specific CSS (.card, .btn, .board, .tabbar, …)

  features/
    auth/                      magic-link sign-in (useSession.js, AuthBox.jsx)
    trackers/                  everything about a single tracker
      useTracker.js             fetching, the count-up animation, and all the mutation calls
      TrackerPage.jsx            composes the pinned ring/log-button + the tab bar
      CreateTracker.jsx, JoinBox.jsx, MyTrackers.jsx, LogFromPhone.jsx, SettingsTab.jsx
      components/                ContributionRing, Leaderboard, ActivityFeed, LogButton

supabase/
  config.toml                 local stack configuration (ports, auth settings, etc.)
  migrations/                 the schema, as an ordered history of SQL files — see above
```

The one rule worth internalizing: **`lib/` never imports from `features/`.**
`lib/` is the dumb, dependency-free foundation everything else is built on;
if something in `lib/` needs to reach into a feature, that's a sign the code
belongs somewhere else.
