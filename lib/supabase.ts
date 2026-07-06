import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Dijeljeni Supabase/GoTrue SSO (domovina-api, api.domovina.ai) — isti identitet
// kao domovina.ai i pinka.io. Anon key je javno-siguran; dashboard NE čita
// Supabase podatke (fiskalni podaci su u D1 iza fiskal API-ja) — Supabase je
// ovdje ISKLJUČIVO za prijavu/sesiju.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let _browser: SupabaseClient | null = null;

/// Browser singleton — čuva sesiju (localStorage) i sam osvježava token.
export function supabaseBrowser(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Nedostaje NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (_browser) return _browser;
  _browser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _browser;
}
