"use client";

// AuthProvider + AuthGate — prijava passkeyem na fiskal Workeru (isti origin).
// Sesija je HttpOnly kolačić `__Host-fiskal_app`; aplikacija ga ne vidi, nego stanje
// čita iz GET /api/v1/ja (200 = prijavljen, 401 = nije). Novi korisnik ulazi samo
// pozivnicom (/app/poziv#token), pa prijava ovdje nema registraciju.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { KeyRound } from "lucide-react";
import { api, fiskal, ODJAVLJEN, type Ja } from "@/lib/fiskal";
import { podrzan, porukaGreske, prijaviPasskeyem } from "@/lib/passkey";

interface AuthState {
  ja: Ja | null;
  loading: boolean;
  /// Ponovno pročitaj /ja (nakon prijave ili pozivnice).
  osvjezi: () => Promise<void>;
  prijava: () => Promise<void>;
  odjava: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ja, setJa] = useState<Ja | null>(null);
  const [loading, setLoading] = useState(true);

  const osvjezi = useCallback(async () => {
    try {
      setJa(await fiskal.ja());
    } catch {
      setJa(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void osvjezi();
    // Bilo koji API poziv s 401 (istekla/opozvana sesija) vraća na prijavu.
    const odjavljen = () => setJa(null);
    window.addEventListener(ODJAVLJEN, odjavljen);
    return () => window.removeEventListener(ODJAVLJEN, odjavljen);
  }, [osvjezi]);

  const value: AuthState = {
    ja,
    loading,
    osvjezi,
    prijava: async () => {
      await prijaviPasskeyem();
      await osvjezi();
    },
    odjava: async () => {
      await api("/odjava", { metoda: "POST", tijelo: {} }).catch(() => undefined);
      setJa(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth se koristi samo unutar AuthProvidera");
  return ctx;
}

/// Gate koji traži prijavljenog korisnika; inače pokazuje prijavu.
export function AuthGate({ children }: { children: ReactNode }) {
  const { ja, loading } = useAuth();
  if (loading) {
    return <div className="py-24 text-center text-muted">Učitavanje…</div>;
  }
  if (!ja) return <Prijava />;
  return <>{children}</>;
}

/// Pomoć kad preglednik ne nudi passkey (tekst iz logomedo docs/admin.md, 23. 11. 2026.).
export function PomocPasskey() {
  return (
    <details className="mt-6 text-xs text-muted">
      <summary className="cursor-pointer hover:text-navy">Windows traži USB sigurnosni ključ?</summary>
      <p className="mt-2">
        To nije kvar. Chrome nudi Google Password Manager samo kad si prijavljen/a u Chrome sa
        sinkronizacijom lozinki; inače posao preda Windowsu, a Windows bez postavljenog Hello PIN-a
        ne nudi ništa osim USB ključa. Rješenje: prijavi se u Chrome i uključi sinkronizaciju pa
        odaberi „Google Password Manager”, ili postavi Windows PIN (Postavke → Računi → Mogućnosti
        prijave). Možeš i mobitelom: odaberi „drugi uređaj” i skeniraj QR kod.
      </p>
    </details>
  );
}

function Prijava() {
  const { prijava } = useAuth();
  const [radi, setRadi] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);
  const [imaWebAuthn, setImaWebAuthn] = useState(true);

  useEffect(() => setImaWebAuthn(podrzan()), []);

  async function prijavi() {
    setRadi(true);
    setGreska(null);
    try {
      await prijava();
    } catch (e) {
      setGreska(porukaGreske(e, "prijava"));
    } finally {
      setRadi(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-rub bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold text-navy">Prijava</h1>
      <p className="mt-2 text-sm text-muted">
        Prijavi se passkeyem koji si izradio/la kad si prihvatio/la pozivnicu (otisak prsta,
        lice, PIN uređaja ili upravitelj lozinki).
      </p>

      <button
        type="button"
        onClick={() => void prijavi()}
        disabled={radi || !imaWebAuthn}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
      >
        <KeyRound className="h-4 w-4" aria-hidden /> {radi ? "Čekam passkey…" : "Prijava passkeyem"}
      </button>

      {!imaWebAuthn ? (
        <p className="mt-4 text-sm text-opasnost">Ovaj preglednik ne podržava passkeye. Otvori dashboard u novijem Chromeu, Safariju, Edgeu ili Firefoxu.</p>
      ) : null}
      {greska ? <p className="mt-4 text-sm text-opasnost">{greska}</p> : null}

      <p className="mt-6 text-xs text-muted">
        Nemaš passkey? Pristup otvara pozivnica (link od vlasnika tvoje firme ili administratora
        servisa). Izgubljen passkey: zatraži novu pozivnicu.
      </p>
      <PomocPasskey />
    </div>
  );
}
