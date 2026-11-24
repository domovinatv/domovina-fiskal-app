"use client";

// Postavke tenanta: poslovni prostori, naplatni uređaji, operateri —
// self-service (uloga „operater" ima samo pregled; server to i enforca s 403).

import { useCallback, useEffect, useState } from "react";
import { DashboardLjuska } from "@/components/ljuska";
import { useTenant } from "@/lib/tenant";
import { LOGO_MAX_BAJTOVA, svgUPng } from "@/lib/logo";
import { fiskal, otvoriPregledIzgleda, type Branding, type BrandingUnos, type Postavke } from "@/lib/fiskal";

export default function PostavkeStranica() {
  return (
    <DashboardLjuska>
      <PostavkePloca />
    </DashboardLjuska>
  );
}

const ulazKlasa =
  "rounded-lg border border-rub bg-white px-3 py-2 text-sm focus:border-navy/40 focus:outline-none";

function PostavkePloca() {
  const { odabrani } = useTenant();
  const [postavke, setPostavke] = useState<Postavke | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [radi, setRadi] = useState(false);

  const smijeMijenjati = odabrani?.uloga !== "operater";

  const ucitaj = useCallback(() => {
    if (!odabrani) return;
    fiskal
      .postavke(odabrani.tenantId)
      .then(setPostavke)
      .catch((e) => setGreska((e as Error).message));
  }, [odabrani]);

  useEffect(() => {
    setPostavke(null);
    setGreska(null);
    setPoruka(null);
    ucitaj();
  }, [ucitaj]);

  async function akcija(fn: () => Promise<unknown>, uspjeh: string) {
    setRadi(true);
    setGreska(null);
    setPoruka(null);
    try {
      await fn();
      setPoruka(uspjeh);
      ucitaj();
    } catch (e) {
      setGreska((e as Error).message);
    } finally {
      setRadi(false);
    }
  }

  if (greska && !postavke) return <p className="text-sm text-opasnost">{greska}</p>;
  if (!postavke || !odabrani) return <p className="text-sm text-muted">Učitavanje…</p>;

  return (
    <>
      <h1 className="text-xl font-bold">
        Postavke <span className="text-sm font-normal text-muted">— {postavke.tenant.naziv} (OIB {postavke.tenant.oib})</span>
      </h1>
      {!smijeMijenjati ? (
        <p className="mt-3 rounded-lg bg-povrsina px-4 py-2 text-sm text-muted">
          Uloga „operater" ima samo pregled postavki — izdavanje računa radi normalno.
        </p>
      ) : null}
      {poruka ? <p className="mt-3 rounded-lg bg-[#E0F1E5] px-4 py-2 text-sm text-uspjeh">{poruka}</p> : null}
      {greska ? <p className="mt-3 rounded-lg bg-[#F8E2E0] px-4 py-2 text-sm text-opasnost">{greska}</p> : null}

      <h2 className="mt-8 text-base font-bold">Poslovni prostori</h2>
      {smijeMijenjati ? (
        <FormaProstor radi={radi} onSubmit={(p) => void akcija(() => fiskal.noviProstor(odabrani.tenantId, p), `Prostor '${p.oznaka}' dodan.`)} />
      ) : null}
      <Tablica
        zaglavlja={["Oznaka", "Adresa", "Primjena od", "CIS status"]}
        redovi={postavke.prostori.map((p) => [
          p.oznaka,
          `${p.ulica ?? ""} ${p.naselje ?? ""}`.trim() || "—",
          p.primjenaOd,
          p.cisStatus,
        ])}
        prazno="Nema prostora."
      />
      <p className="mt-2 text-xs text-muted">
        Prijava prostora u CIS ide kroz ePoreznu; status „prijavljen" označava administrator servisa.
      </p>

      <h2 className="mt-8 text-base font-bold">Naplatni uređaji</h2>
      {smijeMijenjati ? (
        <FormaUredjaj
          prostori={postavke.prostori.map((p) => p.oznaka)}
          radi={radi}
          onSubmit={(u) => void akcija(() => fiskal.noviUredjaj(odabrani.tenantId, u), `Uređaj '${u.oznaka}' dodan.`)}
        />
      ) : null}
      <Tablica
        zaglavlja={["Prostor", "Oznaka", "Opis", "Status"]}
        redovi={postavke.uredjaji.map((u) => [u.prostorOznaka, u.oznaka, u.opis ?? "—", u.aktivan ? "aktivan" : "deaktiviran"])}
        prazno="Nema uređaja."
      />

      <h2 className="mt-8 text-base font-bold">Operateri</h2>
      {smijeMijenjati ? (
        <FormaOperater radi={radi} onSubmit={(o) => void akcija(() => fiskal.noviOperater(odabrani.tenantId, o), `Operater ${o.oib} dodan.`)} />
      ) : null}
      <Tablica
        zaglavlja={["OIB", "Ime", "Status"]}
        redovi={postavke.operateri.map((o) => [o.oib, o.ime ?? "—", o.aktivan ? "aktivan" : "deaktiviran"])}
        prazno="Nema operatera."
      />

      <IzgledRacuna tenantId={odabrani.tenantId} smijeMijenjati={smijeMijenjati} />
    </>
  );
}

// ── Izgled PDF računa: boja, logo, podnožje (backend /postavke/branding) ──

const ZADANA_BOJA = "#002F6C";

function IzgledRacuna({ tenantId, smijeMijenjati }: { tenantId: number; smijeMijenjati: boolean }) {
  const [spremljeno, setSpremljeno] = useState<Branding | null>(null);
  const [boja, setBoja] = useState(ZADANA_BOJA);
  const [vlastitaBoja, setVlastitaBoja] = useState(false);
  const [podnozje, setPodnozje] = useState("");
  const [logo, setLogo] = useState<string | null>(null); // data URL koji se prikazuje
  const [logoPromijenjen, setLogoPromijenjen] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [radi, setRadi] = useState(false);

  const postavi = useCallback((b: Branding) => {
    setSpremljeno(b);
    setVlastitaBoja(!!b.boja);
    setBoja(b.boja ?? ZADANA_BOJA);
    setPodnozje(b.podnozje ?? "");
    setLogo(b.logo);
    setLogoPromijenjen(false);
  }, []);

  useEffect(() => {
    setSpremljeno(null);
    fiskal.branding(tenantId).then(postavi).catch((e) => setGreska((e as Error).message));
  }, [tenantId, postavi]);

  const unos = (): BrandingUnos => ({
    boja: vlastitaBoja ? boja : null,
    podnozje: podnozje.trim() || null,
    ...(logoPromijenjen ? { logo } : {}),
  });

  async function radnja(fn: () => Promise<void>) {
    setRadi(true);
    setGreska(null);
    setPoruka(null);
    try {
      await fn();
    } catch (e) {
      setGreska((e as Error).message);
    } finally {
      setRadi(false);
    }
  }

  async function odaberiLogo(datoteka: File | undefined) {
    setGreska(null);
    if (!datoteka) return;
    // SVG se pretvara u PNG ovdje (lib/logo.ts) — PDF prima samo PNG/JPEG.
    if (datoteka.type === "image/svg+xml" || datoteka.name.toLowerCase().endsWith(".svg")) {
      try {
        setLogo(await svgUPng(datoteka));
        setLogoPromijenjen(true);
      } catch (e) {
        setGreska((e as Error).message);
      }
      return;
    }
    if (!["image/png", "image/jpeg"].includes(datoteka.type)) return setGreska("Logo mora biti SVG, PNG ili JPEG.");
    if (datoteka.size > LOGO_MAX_BAJTOVA) return setGreska(`Logo je ${Math.round(datoteka.size / 1024)} KB — najviše je 200 KB.`);
    const citac = new FileReader();
    citac.onload = () => {
      setLogo(String(citac.result));
      setLogoPromijenjen(true);
    };
    citac.readAsDataURL(datoteka);
  }

  if (!spremljeno) return greska ? <p className="mt-8 text-sm text-opasnost">{greska}</p> : null;

  return (
    <section className="mt-10">
      <h2 className="text-base font-bold">Izgled računa</h2>
      <p className="mt-1 text-sm text-muted">
        Boja, logo i tekst podnožja na PDF-u računa, ponude i predračuna (preuzimanje i e-mail kupcu).
      </p>
      {poruka ? <p className="mt-3 rounded-lg bg-[#E0F1E5] px-4 py-2 text-sm text-uspjeh">{poruka}</p> : null}
      {greska ? <p className="mt-3 rounded-lg bg-[#F8E2E0] px-4 py-2 text-sm text-opasnost">{greska}</p> : null}

      <div className="mt-3 grid gap-4 rounded-xl border border-rub bg-povrsina p-4 sm:grid-cols-2">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Logo</span>
          <div className="mt-2 flex h-20 items-center justify-center rounded-lg border border-dashed border-rub bg-white p-2">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo" className="max-h-16 max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted">bez loga — na računu je naziv</span>
            )}
          </div>
          {smijeMijenjati ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <label className="cursor-pointer rounded-lg border border-rub bg-white px-3 py-1.5 hover:border-navy/40">
                Odaberi SVG/PNG/JPEG…
                <input type="file" accept="image/svg+xml,.svg,image/png,image/jpeg" className="hidden" onChange={(e) => void odaberiLogo(e.target.files?.[0])} />
              </label>
              {logo ? (
                <button type="button" className="text-muted underline" onClick={() => { setLogo(null); setLogoPromijenjen(true); }}>
                  Ukloni logo
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="mt-1 text-xs text-muted">SVG se pretvara u PNG visoke rezolucije. PNG/JPEG najviše 200 KB. Najbolje vodoravni logo s prozirnom pozadinom.</p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Boja</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={boja}
                disabled={!smijeMijenjati}
                onChange={(e) => { setBoja(e.target.value.toUpperCase()); setVlastitaBoja(true); }}
                className="h-9 w-12 cursor-pointer rounded border border-rub bg-white"
                aria-label="Akcentna boja"
              />
              <input
                value={boja}
                disabled={!smijeMijenjati}
                onChange={(e) => { setBoja(e.target.value); setVlastitaBoja(true); }}
                pattern="#[0-9a-fA-F]{6}"
                className={`${ulazKlasa} w-28 font-mono`}
                aria-label="Boja (hex)"
              />
              {vlastitaBoja && smijeMijenjati ? (
                <button type="button" className="text-sm text-muted underline" onClick={() => { setBoja(ZADANA_BOJA); setVlastitaBoja(false); }}>
                  zadana
                </button>
              ) : null}
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Podnožje</span>
            <input
              value={podnozje}
              disabled={!smijeMijenjati}
              maxLength={160}
              onChange={(e) => setPodnozje(e.target.value)}
              placeholder="npr. www.primjer.hr · +385 1 234 5678"
              className={`${ulazKlasa} mt-2 w-full`}
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={radi}
          onClick={() => void radnja(() => otvoriPregledIzgleda(tenantId, unos()))}
          className="rounded-lg border border-rub bg-white px-4 py-2 text-sm font-bold hover:border-navy/40 disabled:opacity-50"
        >
          Pregledaj ogledni PDF
        </button>
        {smijeMijenjati ? (
          <>
            <button
              type="button"
              disabled={radi}
              onClick={() => void radnja(async () => { postavi(await fiskal.spremiBranding(tenantId, unos())); setPoruka("Izgled računa spremljen."); })}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
            >
              Spremi izgled
            </button>
            {spremljeno.azurirano ? (
              <button
                type="button"
                disabled={radi}
                onClick={() => void radnja(async () => { postavi(await fiskal.obrisiBranding(tenantId)); setPoruka("Vraćen zadani izgled."); })}
                className="px-2 py-2 text-sm text-muted underline disabled:opacity-50"
              >
                Vrati zadani izgled
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function Tablica({ zaglavlja, redovi, prazno }: { zaglavlja: string[]; redovi: string[][]; prazno: string }) {
  if (!redovi.length) return <p className="mt-3 text-sm italic text-muted">{prazno}</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rub text-left text-xs uppercase tracking-wider text-muted">
            {zaglavlja.map((z) => (
              <th key={z} className="py-2 pr-3">{z}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {redovi.map((red, i) => (
            <tr key={i} className="border-b border-rub">
              {red.map((c, j) => (
                <td key={j} className="py-2.5 pr-3">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormaProstor({ radi, onSubmit }: { radi: boolean; onSubmit: (p: { oznaka: string; ulica?: string; naselje?: string; primjenaOd: string }) => void }) {
  const [oznaka, setOznaka] = useState("");
  const [ulica, setUlica] = useState("");
  const [naselje, setNaselje] = useState("");
  const [datum, setDatum] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-rub bg-povrsina p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ oznaka, ulica: ulica || undefined, naselje: naselje || undefined, primjenaOd: datum });
        setOznaka("");
      }}
    >
      <input required value={oznaka} onChange={(e) => setOznaka(e.target.value)} placeholder="Oznaka (oznPP) *" className={ulazKlasa} />
      <input value={ulica} onChange={(e) => setUlica(e.target.value)} placeholder="Ulica i kbr" className={ulazKlasa} />
      <input value={naselje} onChange={(e) => setNaselje(e.target.value)} placeholder="Naselje" className={ulazKlasa} />
      <input required type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={ulazKlasa} aria-label="Primjena od" />
      <button type="submit" disabled={radi} className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50">
        Dodaj prostor
      </button>
    </form>
  );
}

function FormaUredjaj({ prostori, radi, onSubmit }: { prostori: string[]; radi: boolean; onSubmit: (u: { prostorOznaka: string; oznaka: string; opis?: string }) => void }) {
  const [prostor, setProstor] = useState(prostori[0] ?? "");
  const [oznaka, setOznaka] = useState("");
  const [opis, setOpis] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-rub bg-povrsina p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ prostorOznaka: prostor, oznaka, opis: opis || undefined });
        setOznaka("");
      }}
    >
      <select required value={prostor} onChange={(e) => setProstor(e.target.value)} className={ulazKlasa} aria-label="Poslovni prostor">
        {prostori.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <input required value={oznaka} onChange={(e) => setOznaka(e.target.value)} placeholder="Oznaka (oznNU) *" className={ulazKlasa} />
      <input value={opis} onChange={(e) => setOpis(e.target.value)} placeholder="Opis" className={ulazKlasa} />
      <button type="submit" disabled={radi} className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50">
        Dodaj uređaj
      </button>
    </form>
  );
}

function FormaOperater({ radi, onSubmit }: { radi: boolean; onSubmit: (o: { oib: string; ime?: string }) => void }) {
  const [oib, setOib] = useState("");
  const [ime, setIme] = useState("");
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-rub bg-povrsina p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ oib, ime: ime || undefined });
        setOib("");
      }}
    >
      <input required value={oib} onChange={(e) => setOib(e.target.value)} pattern="\d{11}" placeholder="OIB operatera *" className={ulazKlasa} />
      <input value={ime} onChange={(e) => setIme(e.target.value)} placeholder="Ime" className={ulazKlasa} />
      <button type="submit" disabled={radi} className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50">
        Dodaj operatera
      </button>
    </form>
  );
}
