import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public (browser-safe) Supabase config. The anon key is meant to ship to the
// client; row-level security in the database is what protects data.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// True only when both keys are present. When false the whole app falls back to
// localStorage, so it always runs with zero setup (and never crashes if the
// cloud isn't configured yet).
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(url as string, anonKey as string, {
    auth: {
      // Client-only session, persisted in localStorage — matches the app's
      // existing client-rendered, no-SSR-cookies model.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export const supabase = client;
