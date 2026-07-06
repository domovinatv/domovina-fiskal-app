"use client";

// AuthProvider + AuthGate — obrazac posuđen iz pinka-finance/app (isti dijeljeni
// GoTrue). v1 prijava: email OTP (6-znamenkasti kod / magic link) + Google OAuth.
// Certilia (eOsobna) i passkey mogu se kasnije posuditi iz pinke po potrebi.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, code: string) => Promise<void>;
  /// Google OAuth preko dijeljenog GoTrue-a — full-page redirect, sesija se
  /// vraća na /dashboard (detectSessionInUrl).
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    loading,
    signInWithEmail: async (email: string) => {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
      const { error } = await supabaseBrowser().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
    },
    verifyEmailOtp: async (email: string, code: string) => {
      const { error } = await supabaseBrowser().auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
    },
    signInWithGoogle: async () => {
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      // Preglednik odlazi na Google — ovdje nema više posla.
    },
    signOut: async () => {
      await supabaseBrowser().auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth se koristi samo unutar AuthProvidera");
  return ctx;
}

/// Gate koji traži prijavljenog (NE-anonimnog) korisnika; inače pokazuje prijavu.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const prijavljen = !!user && !user.is_anonymous;

  if (loading) {
    return <div className="py-24 text-center text-muted">Učitavanje…</div>;
  }
  if (!prijavljen) return <Prijava />;
  return <>{children}</>;
}

function GoogleIkona() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3a7.18 7.18 0 0 1-10.8-3.78H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.26 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.27a12 12 0 0 0 0 10.8l3.99-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.97 11.97 0 0 0 1.27 6.6l3.99 3.1A7.18 7.18 0 0 1 12 4.77Z" />
    </svg>
  );
}

function Prijava() {
  const { signInWithEmail, verifyEmailOtp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [kod, setKod] = useState("");
  // korak "email" → unos adrese; korak "kod" → unos 6-znamenkastog koda (ili
  // klik na link u mailu, koji prijavljuje kroz onAuthStateChange).
  const [korak, setKorak] = useState<"email" | "kod">("email");
  const [radi, setRadi] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);

  async function posaljiKod() {
    setRadi(true);
    setGreska(null);
    try {
      await signInWithEmail(email.trim());
      setKorak("kod");
    } catch {
      setGreska("Slanje koda nije uspjelo — provjeri adresu i pokušaj ponovno.");
    } finally {
      setRadi(false);
    }
  }

  async function potvrdiKod(e: React.FormEvent) {
    e.preventDefault();
    setRadi(true);
    setGreska(null);
    try {
      await verifyEmailOtp(email, kod);
    } catch {
      setGreska("Kod nije prihvaćen — provjeri znamenke ili zatraži novi.");
    } finally {
      setRadi(false);
    }
  }

  async function google() {
    setRadi(true);
    setGreska(null);
    try {
      await signInWithGoogle();
    } catch {
      setGreska("Google prijava nije uspjela — pokušaj ponovno.");
      setRadi(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-rub bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold text-navy">Prijava</h1>
      <p className="mt-2 text-sm text-muted">
        Prijavi se svojim Domovina računom — isti račun vrijedi na domovina.ai i
        pinka.io (jedan identitet za cijeli ekosustav).
      </p>

      {korak === "email" ? (
        <>
          <button
            type="button"
            onClick={() => void google()}
            disabled={radi}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-rub bg-white px-4 py-3 text-sm font-semibold text-navy transition hover:border-navy/30 disabled:opacity-50"
          >
            <GoogleIkona /> Nastavi s Googleom
          </button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-rub" /> ili <span className="h-px flex-1 bg-rub" />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void posaljiKod(); }} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tvoja@adresa.hr"
              className="w-full rounded-lg border border-rub px-4 py-3 text-sm focus:border-navy/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={radi}
              className="w-full rounded-lg bg-navy px-4 py-3 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
            >
              {radi ? "Slanje…" : "Pošalji kod za prijavu"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            Poslali smo kod na <strong className="text-navy">{email}</strong> — upiši ga
            (ili klikni link u poruci).
          </p>
          <form onSubmit={potvrdiKod} className="mt-4 space-y-3">
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              value={kod}
              onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full rounded-lg border border-rub px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] focus:border-navy/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={radi || kod.length < 6}
              className="w-full rounded-lg bg-navy px-4 py-3 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
            >
              {radi ? "Provjera…" : "Potvrdi i prijavi se"}
            </button>
          </form>
          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            <button type="button" className="hover:text-navy" onClick={() => { setKorak("email"); setKod(""); setGreska(null); }}>
              ← promijeni adresu
            </button>
            <button type="button" className="hover:text-navy disabled:opacity-50" disabled={radi} onClick={() => void posaljiKod()}>
              pošalji novi kod
            </button>
          </div>
        </>
      )}
      {greska ? <p className="mt-4 text-sm text-opasnost">{greska}</p> : null}
    </div>
  );
}
