"use client";

// Fiskal API klijent — jedino mjesto koje zove fiskal.domovina.ai/api/v1.
// Na SVAKI poziv lijepi 'Authorization: Bearer <GoTrue access_token>' +
// 'X-Tenant-Id: <odabrani tenant>'. Podaci su u D1 iza Workera — dashboard
// NE čita Supabase (Supabase je samo prijava). Vidi backend repo:
// domovina-fiskal/docs/knowledge/16-dashboard-sso.md.

import { supabaseBrowser } from "@/lib/supabase";

const API_URL = (process.env.NEXT_PUBLIC_FISKAL_API_URL ?? "https://fiskal.domovina.ai/api/v1").replace(/\/$/, "");

export class FiskalGreska extends Error {
  constructor(
    message: string,
    public status: number,
    public detalji?: { polje: string; poruka: string }[],
  ) {
    super(message);
  }
}

async function accessToken(): Promise<string> {
  const { data } = await supabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new FiskalGreska("Nisi prijavljen", 401);
  return token;
}

async function poziv<T>(
  put: string,
  opts: { metoda?: "GET" | "POST"; tijelo?: unknown; tenantId?: number | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
  };
  if (opts.tenantId) headers["X-Tenant-Id"] = String(opts.tenantId);
  if (opts.tijelo !== undefined) headers["Content-Type"] = "application/json";

  const r = await fetch(`${API_URL}${put}`, {
    method: opts.metoda ?? "GET",
    headers,
    body: opts.tijelo !== undefined ? JSON.stringify(opts.tijelo) : undefined,
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    throw new FiskalGreska(
      String(json.greska ?? `Greška ${r.status}`),
      r.status,
      json.detalji as FiskalGreska["detalji"],
    );
  }
  return json as T;
}

// ── Tipovi odgovora (podskup koji dashboard koristi) ──

export interface MojTenant {
  tenantId: number;
  oib: string;
  naziv: string;
  uloga: "vlasnik" | "knjigovodja" | "operater";
}

export interface RacunSazetak {
  id: number;
  brojRacuna: string | null;
  tip: string;
  status: string;
  datumVrijeme: string;
  valuta: string;
  iznosSPdv: string | null;
}

export interface RacunDetalj extends RacunSazetak {
  iznosi: { neto: string; iznosBezPdv: string; pdv: string; iznosSPdv: string; dospijevaZaPlacanje: string } | null;
  nacinPlacanja: string | null;
  napomena: string | null;
  klauzulaPdv: string | null;
  stavke: {
    redniBroj: number;
    naziv: string;
    kolicina: string;
    jedinicaMjere: string;
    netoCijena: string;
    popustPosto: string;
    pdvStopa: string;
  }[];
  zki: string | null;
  jir: string | null;
  fiskalniQr: string | null;
  fiskalGreska?: string | null;
  poslanoEmail: { kada: string; na: string } | null;
  pdf: string;
}

export interface Proizvod {
  id: number;
  naziv: string;
  sifra: string | null;
  jedinicaMjere: string;
  netoCijena: string;
  pdvStopa: string;
  pdvKategorija: string;
  kpd: string | null;
  aktivan: boolean;
}

export interface Postavke {
  tenant: { id: number; oib: string; naziv: string; uSustavuPdv: boolean };
  prostori: { id: number; oznaka: string; ulica: string | null; naselje: string | null; primjenaOd: string; zatvoren: string | null; cisStatus: string }[];
  uredjaji: { id: number; prostorOznaka: string; oznaka: string; opis: string | null; aktivan: boolean }[];
  operateri: { id: number; oib: string; ime: string | null; aktivan: boolean }[];
}

export interface NoviRacunPayload {
  tip: "PONUDA" | "PREDRACUN" | "RACUN" | "FISKALNI_B2C";
  poslovniProstor: string;
  naplatniUredaj: string;
  operaterOib?: string;
  nacinPlacanja: string;
  datumDospijeca?: string;
  napomena?: string;
  kupac?: { naziv: string; oib?: string; email?: string };
  stavke: {
    proizvodId?: number;
    naziv?: string;
    kolicina: number | string;
    jedinicaMjere?: string;
    netoCijena?: string;
    popustPosto?: string;
    pdvStopa?: string;
    kpd?: string;
  }[];
  status?: "nacrt" | "izdano";
}

// ── Pozivi ──

export const fiskal = {
  mojiTenanti: () => poziv<{ tenanti: MojTenant[] }>("/moji-tenanti"),
  racuni: (tenantId: number, limit = 50) =>
    poziv<{ racuni: RacunSazetak[] }>(`/racun?limit=${limit}`, { tenantId }),
  racun: (tenantId: number, id: number) => poziv<RacunDetalj>(`/racun/${id}`, { tenantId }),
  noviRacun: (tenantId: number, payload: NoviRacunPayload) =>
    poziv<RacunDetalj & { fiskalizacija?: { status: string; greska?: string | null } }>("/racun", {
      metoda: "POST",
      tijelo: payload,
      tenantId,
    }),
  izdaj: (tenantId: number, id: number) =>
    poziv<RacunDetalj>(`/racun/${id}/izdaj`, { metoda: "POST", tenantId }),
  fiskaliziraj: (tenantId: number, id: number) =>
    poziv<RacunDetalj>(`/racun/${id}/fiskaliziraj`, { metoda: "POST", tenantId }),
  posalji: (tenantId: number, id: number, na?: string) =>
    poziv<{ ok: boolean; poslanoNa: string }>(`/racun/${id}/posalji`, {
      metoda: "POST",
      tijelo: na ? { na } : {},
      tenantId,
    }),
  proizvodi: (tenantId: number) => poziv<{ proizvodi: Proizvod[] }>("/proizvod", { tenantId }),
  postavke: (tenantId: number) => poziv<Postavke>("/postavke", { tenantId }),
  noviProstor: (tenantId: number, p: { oznaka: string; ulica?: string; naselje?: string; primjenaOd: string }) =>
    poziv<{ id: number }>("/postavke/prostor", { metoda: "POST", tijelo: p, tenantId }),
  noviUredjaj: (tenantId: number, u: { prostorOznaka: string; oznaka: string; opis?: string }) =>
    poziv<{ id: number }>("/postavke/uredjaj", { metoda: "POST", tijelo: u, tenantId }),
  noviOperater: (tenantId: number, o: { oib: string; ime?: string }) =>
    poziv<{ id: number }>("/postavke/operater", { metoda: "POST", tijelo: o, tenantId }),
};

/// PDF traži Authorization header (ne može običan <a href>) — fetch + blob.
export async function otvoriPdf(tenantId: number, racunId: number): Promise<void> {
  const r = await fetch(`${API_URL}/racun/${racunId}/pdf`, {
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "X-Tenant-Id": String(tenantId),
    },
  });
  if (!r.ok) throw new FiskalGreska(`PDF nije dostupan (${r.status})`, r.status);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
