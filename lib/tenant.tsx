"use client";

// Tenant context — M od N tenanata s dropdown prebacivanjem. Lista dolazi iz
// GET /moji-tenanti (fiskal API, samo JWT); odabir se pamti u localStorage pa
// preživljava refresh. Svi fiskal pozivi su scope-ani na odabrani tenant.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fiskal, type MojTenant } from "@/lib/fiskal";
import { useAuth } from "@/lib/auth";

const LS_KLJUC = "fiskal.odabraniTenant";

interface TenantState {
  tenanti: MojTenant[];
  odabrani: MojTenant | null;
  ucitavanje: boolean;
  greska: string | null;
  odaberi: (tenantId: number) => void;
  osvjezi: () => Promise<void>;
}

const TenantContext = createContext<TenantState | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tenanti, setTenanti] = useState<MojTenant[]>([]);
  const [odabraniId, setOdabraniId] = useState<number | null>(null);
  const [ucitavanje, setUcitavanje] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const osvjezi = useCallback(async () => {
    setUcitavanje(true);
    setGreska(null);
    try {
      const { tenanti: lista } = await fiskal.mojiTenanti();
      setTenanti(lista);
      // Vrati zapamćeni odabir ako i dalje postoji u membershipima; inače prvi.
      const zapamcen = Number(localStorage.getItem(LS_KLJUC) ?? 0);
      const vazeci = lista.find((t) => t.tenantId === zapamcen) ?? lista[0] ?? null;
      setOdabraniId(vazeci?.tenantId ?? null);
    } catch (e) {
      setGreska((e as Error).message);
      setTenanti([]);
      setOdabraniId(null);
    } finally {
      setUcitavanje(false);
    }
  }, []);

  useEffect(() => {
    if (user && !user.is_anonymous) void osvjezi();
  }, [user, osvjezi]);

  const value: TenantState = {
    tenanti,
    odabrani: tenanti.find((t) => t.tenantId === odabraniId) ?? null,
    ucitavanje,
    greska,
    odaberi: (tenantId: number) => {
      setOdabraniId(tenantId);
      localStorage.setItem(LS_KLJUC, String(tenantId));
    },
    osvjezi,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant se koristi samo unutar TenantProvidera");
  return ctx;
}
