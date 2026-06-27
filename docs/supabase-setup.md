# Cloud sync setup (Supabase) — free, no card

This connects accounts + cloud sync + sharing. It costs **nothing** and needs
**no credit card**. Until you do this, the app runs entirely on localStorage —
nothing breaks, there's just no account/cloud.

Takes about 5 minutes.

## 1. Create a free project
1. Go to **https://supabase.com** → sign up (GitHub or email). No card asked.
2. **New project** → give it a name (e.g. `wedding-flow-studio`), set a database
   password (save it somewhere), pick the closest region → **Create**.
3. Wait ~1 minute for it to provision.

## 2. Create the tables
1. In the project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this repo, copy everything, paste it in, and
   click **Run**. You should see "Success".

## 3. Turn on email login
1. **Authentication → Sign In / Providers** → make sure **Email** is enabled.
2. For easiest testing, **Authentication → Providers → Email** → turn **Confirm
   email** *off* (so you can sign in instantly without clicking a link). You can
   turn it back on later.

## 4. Paste the two keys
1. **Settings → API**. Copy the **Project URL** and the **anon public** key.
2. In the repo, copy `.env.local.example` to `.env.local` and paste them:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```
3. Restart `npm run dev`.

## Done
Open **/account** — you can now create an account and sign in. Once you're
signed in, your plan syncs to the cloud (and the next phases add sharing +
real-time co-editing).

> Staying free: the free tier is plenty for personal use and small scale. A free
> Supabase project pauses after ~1 week of no activity — just open the dashboard
> to wake it. Nothing can ever charge you unless you explicitly add a paid plan.
