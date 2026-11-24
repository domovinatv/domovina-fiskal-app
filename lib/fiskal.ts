"use client";

// Fiskal API klijent — jedino mjesto koje zove /api/v1. Dashboard i API su na
// istom originu (fiskal Worker servira app na /app), pa prijavu nosi kolačić
// sesije `__Host-fiskal_app` (credentials: same-origin), bez Authorization
// zaglavlja; 'X-Tenant-Id' bira tenant. Mutacije šalju Origin same (preglednik),
// a backend ga provjerava. Vidi backend repo: domovina-fiskal/docs/passkey/.

const API_URL = "/api/v1";

export class FiskalGreska extends Error {
  constructor(
    message: string,
    public status: number,
    public detalji?: { polje: string; poruka: string }[],
  ) {
    super(message);
  }
}

async function poziv<T>(
  put: string,
  opts: { metoda?: "GET" | "POST" | "PUT" | "DELETE"; tijelo?: unknown; tenantId?: number | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.tenantId) headers["X-Tenant-Id"] = String(opts.tenantId);
  if (opts.tijelo !== undefined) headers["Content-Type"] = "application/json";

  const r = await fetch(`${API_URL}${put}`, {
    method: opts.metoda ?? "GET",
    credentials: "same-origin",
    headers,
    body: opts.tijelo !== undefined ? JSON.stringify(opts.tijelo) : undefined,
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    // Istekla ili opozvana sesija: AuthProvider vraća na prijavu.
    if (r.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event(ODJAVLJEN));
    throw new FiskalGreska(
      String(json.greska ?? `Greška ${r.status}`),
      r.status,
      json.detalji as FiskalGreska["detalji"],
    );
  }
  return json as T;
}

/// Događaj na `window` kad API vrati 401 (sesija istekla ili opozvana).
export const ODJAVLJEN = "fiskal:odjavljen";

/// Poziv bez tenanta (prijava, poziv, moji passkeyi) — isti oblik grešaka.
export function api<T>(put: string, opts: { metoda?: "GET" | "POST" | "DELETE"; tijelo?: unknown; tenantId?: number | null } = {}) {
  return poziv<T>(put, opts);
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
  /// eRačun 2.0 (doku) — backend ga vraća samo za tipove eracun_b2b/eracun_b2g.
  eracun?: {
    dokuId: number | null;
    status: "IMPORTED" | "DELIVERED" | "FISCALIZED" | string | null;
    deliveryBlock: string | null;
    zadnjaProvjera: string | null;
    greska: string | null;
  };
}

export interface KpdStavka {
  sifra: string;
  naziv: string;
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

/// Izgled PDF računa (backend src/pdf/branding.ts). logo = data URL ili null.
export interface Branding {
  boja: string | null;
  podnozje: string | null;
  logo: string | null;
  azurirano: string | null;
}

/// Tijelo PUT-a i pregleda: logo izostavljen = ne mijenja se, null = ukloni.
export interface BrandingUnos {
  boja: string | null;
  podnozje: string | null;
  logo?: string | null;
}

export interface Postavke {
  tenant: { id: number; oib: string; naziv: string; uSustavuPdv: boolean };
  prostori: { id: number; oznaka: string; ulica: string | null; naselje: string | null; primjenaOd: string; zatvoren: string | null; cisStatus: string }[];
  uredjaji: { id: number; prostorOznaka: string; oznaka: string; opis: string | null; aktivan: boolean }[];
  operateri: { id: number; oib: string; ime: string | null; aktivan: boolean }[];
}

export interface NoviRacunPayload {
  tip: "PONUDA" | "PREDRACUN" | "RACUN" | "FISKALNI_B2C" | "ERACUN_B2B" | "ERACUN_B2G";
  poslovniProstor: string;
  naplatniUredaj: string;
  operaterOib?: string;
  nacinPlacanja: string;
  datumDospijeca?: string;
  napomena?: string;
  kupac?: {
    naziv: string;
    oib?: string;
    email?: string;
    adresa?: { ulica?: string; grad?: string; postanskiBroj?: string; drzava?: string };
  };
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

export interface Ja {
  email: string;
  ime: string | null;
  korisnikId: number;
  prijava: { metoda: string; od: string; do: string };
  tenanti: MojTenant[];
}

export interface MojPasskey {
  id: number;
  oznaka: string | null;
  stvoren: string;
  zadnjeKoristen: string | null;
}

export type Uloga = MojTenant["uloga"];

export interface Clan {
  id: number;
  email: string;
  ime: string | null;
  uloga: Uloga;
  aktivan: boolean;
  imaPasskey: boolean;
  korisnikAktivan: boolean | null;
  ja: boolean;
}

/** Odgovor na izdavanje: pozivnica je odmah poslana mailom (`poslano`); link je rezerva, vidi se samo ovdje. */
export interface IzdanaPozivnica {
  id: number;
  email: string;
  istjece: string;
  link: string;
  poslano: boolean;
  emailGreska: string | null;
}

export interface OtvorenaPozivnica {
  id: number;
  email: string;
  ime: string | null;
  uloga: Uloga;
  stvorioTip: string;
  stvorena: string;
  istjece: string;
}

// ── Pozivi ──

export const fiskal = {
  ja: () => poziv<Ja>("/ja"),
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
  // ── eRačun 2.0 (doku posrednik) ──
  posaljiEracun: (tenantId: number, id: number) =>
    poziv<{ ok: boolean; dokuId: number; eracunStatus: string | null; deliveryBlock: string | null; napomena?: string }>(
      `/racun/${id}/posalji-eracun`,
      { metoda: "POST", tenantId },
    ),
  eracunStatus: (tenantId: number, id: number) =>
    poziv<{ ok: boolean; dokuId: number; eracunStatus: string | null }>(`/racun/${id}/eracun-status`, { tenantId }),
  provjeriPrimatelja: (tenantId: number, oib: string) =>
    poziv<{ ok: boolean; oib: string; registriran: boolean; mpsEndpoint?: string }>("/eracun/provjeri-primatelja", {
      metoda: "POST",
      tijelo: { oib },
      tenantId,
    }),
  kpdTrazi: (tenantId: number, q: string, limit = 20) =>
    poziv<{ rezultati: KpdStavka[] }>(`/kpd?q=${encodeURIComponent(q)}&limit=${limit}`, { tenantId }),
  proizvodi: (tenantId: number) => poziv<{ proizvodi: Proizvod[] }>("/proizvod", { tenantId }),
  // ── Moji passkeyi (bez tenanta) ──
  passkeyi: () => poziv<{ passkeyi: MojPasskey[]; dodavanje: string | null }>("/passkeyi"),
  obrisiPasskey: (id: number) => poziv<{ ok: boolean }>(`/passkeyi/${id}`, { metoda: "DELETE" }),
  // ── Članovi tenanta (samo vlasnik) ──
  clanovi: (tenantId: number) =>
    poziv<{ clanovi: Clan[]; pozivnice: OtvorenaPozivnica[] }>("/clanovi", { tenantId }),
  pozovi: (tenantId: number, p: { email: string; ime?: string; uloga: "knjigovodja" | "operater" }) =>
    poziv<IzdanaPozivnica>("/clanovi/pozivnica", {
      metoda: "POST",
      tijelo: p,
      tenantId,
    }),
  // Nova pozivnica istih podataka ide mailom; stari link prestaje vrijediti.
  posaljiPonovno: (tenantId: number, id: number) =>
    poziv<IzdanaPozivnica>(`/clanovi/pozivnica/${id}/posalji-ponovno`, { metoda: "POST", tenantId }),
  opozoviPozivnicu: (tenantId: number, id: number) =>
    poziv<{ ok: boolean }>(`/clanovi/pozivnica/${id}/opozovi`, { metoda: "POST", tenantId }),
  deaktivirajClana: (tenantId: number, id: number) =>
    poziv<{ ok: boolean }>(`/clanovi/${id}/deaktiviraj`, { metoda: "POST", tenantId }),
  postavke: (tenantId: number) => poziv<Postavke>("/postavke", { tenantId }),
  noviProstor: (tenantId: number, p: { oznaka: string; ulica?: string; naselje?: string; primjenaOd: string }) =>
    poziv<{ id: number }>("/postavke/prostor", { metoda: "POST", tijelo: p, tenantId }),
  noviUredjaj: (tenantId: number, u: { prostorOznaka: string; oznaka: string; opis?: string }) =>
    poziv<{ id: number }>("/postavke/uredjaj", { metoda: "POST", tijelo: u, tenantId }),
  noviOperater: (tenantId: number, o: { oib: string; ime?: string }) =>
    poziv<{ id: number }>("/postavke/operater", { metoda: "POST", tijelo: o, tenantId }),
  branding: (tenantId: number) => poziv<Branding>("/postavke/branding", { tenantId }),
  spremiBranding: (tenantId: number, b: BrandingUnos) =>
    poziv<Branding>("/postavke/branding", { metoda: "PUT", tijelo: b, tenantId }),
  obrisiBranding: (tenantId: number) => poziv<Branding>("/postavke/branding", { metoda: "DELETE", tenantId }),
};

/// Ogledni PDF s (nespremljenim) izgledom — otvara se u novoj kartici.
/// Prozor se otvara ODMAH (u klik-događaju), inače ga Safari blokira nakon await-a.
export async function otvoriPregledIzgleda(tenantId: number, b: BrandingUnos): Promise<void> {
  const prozor = window.open("", "_blank");
  const r = await fetch(`${API_URL}/postavke/branding/pregled`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-Tenant-Id": String(tenantId), "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
  if (!r.ok) {
    prozor?.close();
    const j = (await r.json().catch(() => ({}))) as { greska?: string };
    throw new FiskalGreska(j.greska ?? `Pregled nije dostupan (${r.status})`, r.status);
  }
  const url = URL.createObjectURL(await r.blob());
  if (prozor) prozor.location.href = url;
  else window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/// PDF traži X-Tenant-Id zaglavlje (ne može običan <a href>) — fetch + blob.
export async function otvoriPdf(tenantId: number, racunId: number): Promise<void> {
  const r = await fetch(`${API_URL}/racun/${racunId}/pdf`, {
    credentials: "same-origin",
    headers: { "X-Tenant-Id": String(tenantId) },
  });
  if (!r.ok) throw new FiskalGreska(`PDF nije dostupan (${r.status})`, r.status);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
