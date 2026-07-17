"use client";

// Detalj dokumenta (?id=N — query param umjesto dinamičke rute zbog statičkog
// exporta, isti obrazac kao pinka). Akcije: izdaj / fiskaliziraj / pošalji / PDF.

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown, Loader2, Mail, RefreshCw, Send, Stamp, Zap } from "lucide-react";
import { DashboardLjuska } from "@/components/ljuska";
import { useTenant } from "@/lib/tenant";
import { fiskal, otvoriPdf, type RacunDetalj } from "@/lib/fiskal";
import { iznosHr, statusPilula, tipNaziv } from "@/lib/format";

export default function RacunStranica() {
  return (
    <DashboardLjuska>
      <Suspense fallback={<p className="text-sm text-muted">Učitavanje…</p>}>
        <Detalj />
      </Suspense>
    </DashboardLjuska>
  );
}

function Detalj() {
  const { odabrani } = useTenant();
  const params = useSearchParams();
  const id = Number(params.get("id") ?? 0);
  const [racun, setRacun] = useState<RacunDetalj | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [radi, setRadi] = useState(false);
  const [emailNa, setEmailNa] = useState("");

  const ucitaj = useCallback(() => {
    if (!odabrani || !id) return;
    fiskal
      .racun(odabrani.tenantId, id)
      .then(setRacun)
      .catch((e) => setGreska((e as Error).message));
  }, [odabrani, id]);

  useEffect(() => {
    setRacun(null);
    setGreska(null);
    ucitaj();
  }, [ucitaj]);

  async function akcija(fn: () => Promise<unknown>, uspjeh: string) {
    if (!odabrani) return;
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

  if (!id) return <p className="text-sm text-opasnost">Nedostaje ?id= parametar.</p>;
  if (greska && !racun) return <p className="text-sm text-opasnost">{greska}</p>;
  if (!racun || !odabrani) return <p className="text-sm text-muted">Učitavanje…</p>;

  const jeSkica = racun.status === "nacrt";
  const jeFiskalni = racun.tip === "fiskalni_b2c";
  const jeEracun = racun.tip === "eracun_b2b" || racun.tip === "eracun_b2g";

  // Slanje posredniku doku (~2-5 s) — poruka ovisi o ishodu (npr. AMS blok).
  async function posaljiEracun() {
    if (!odabrani || !racun) return;
    setRadi(true);
    setGreska(null);
    setPoruka(null);
    try {
      const r = await fiskal.posaljiEracun(odabrani.tenantId, racun.id);
      setPoruka(
        r.napomena
          ? `eRačun poslan (doku ID ${r.dokuId}) — ${r.napomena}`
          : `eRačun poslan posredniku (doku ID ${r.dokuId})${r.eracunStatus ? ` — status: ${r.eracunStatus}` : ""}.`,
      );
      ucitaj();
    } catch (e) {
      setGreska((e as Error).message);
    } finally {
      setRadi(false);
    }
  }

  return (
    <>
      <p className="text-sm">
        <Link href="/dashboard" className="text-muted hover:text-navy">← svi dokumenti</Link>
      </p>
      <h1 className="mt-2 flex items-center gap-3 text-xl font-bold">
        {tipNaziv(racun.tip)}{" "}
        <span className="font-mono">{racun.brojRacuna ?? `#${racun.id} (skica)`}</span>
        {statusPilula(racun.status)}
      </h1>

      {poruka ? <p className="mt-3 rounded-lg bg-[#E0F1E5] px-4 py-2 text-sm text-uspjeh">{poruka}</p> : null}
      {greska ? <p className="mt-3 rounded-lg bg-[#F8E2E0] px-4 py-2 text-sm text-opasnost">{greska}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {jeSkica ? (
          <button
            type="button"
            disabled={radi}
            onClick={() => void akcija(() => fiskal.izdaj(odabrani.tenantId, racun.id), "Dokument izdan — dodijeljen broj.")}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
          >
            <Stamp className="h-4 w-4" aria-hidden /> Izdaj (dodijeli broj)
          </button>
        ) : null}
        {jeEracun && racun.status === "izdano" && !racun.eracun?.dokuId ? (
          <button
            type="button"
            disabled={radi}
            onClick={() => void posaljiEracun()}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
          >
            {radi ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {radi ? "Slanje eRačuna…" : "Pošalji eRačun"}
          </button>
        ) : null}
        {jeFiskalni && !racun.jir ? (
          <button
            type="button"
            disabled={radi}
            onClick={() => void akcija(() => fiskal.fiskaliziraj(odabrani.tenantId, racun.id), "Fiskalizirano — JIR dodijeljen.")}
            className="flex items-center gap-1.5 rounded-lg bg-crvena px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" aria-hidden /> Fiskaliziraj (CIS)
          </button>
        ) : null}
        <button
          type="button"
          disabled={radi}
          onClick={() => void otvoriPdf(odabrani.tenantId, racun.id).catch((e) => setGreska((e as Error).message))}
          className="flex items-center gap-1.5 rounded-lg border border-rub px-4 py-2 text-sm font-bold text-navy hover:border-navy/30 disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" aria-hidden /> PDF
        </button>
        {!jeSkica ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void akcija(
                () => fiskal.posalji(odabrani.tenantId, racun.id, emailNa.trim() || undefined),
                "Dokument poslan e-mailom.",
              );
            }}
          >
            <input
              type="email"
              value={emailNa}
              onChange={(e) => setEmailNa(e.target.value)}
              placeholder="email primatelja"
              className="rounded-lg border border-rub px-3 py-2 text-sm focus:border-navy/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={radi}
              className="flex items-center gap-1.5 rounded-lg border border-rub px-4 py-2 text-sm font-bold text-navy hover:border-navy/30 disabled:opacity-50"
            >
              <Mail className="h-4 w-4" aria-hidden /> Pošalji
            </button>
          </form>
        ) : null}
      </div>

      {jeEracun ? (
        <div className="mt-5 rounded-xl border border-rub bg-povrsina p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold">eRačun — razmjena (doku)</p>
            {racun.eracun?.dokuId ? (
              <button
                type="button"
                disabled={radi}
                onClick={() => void akcija(() => fiskal.eracunStatus(odabrani.tenantId, racun.id), "Status razmjene osvježen.")}
                className="flex items-center gap-1.5 rounded-lg border border-rub px-3 py-1.5 text-xs font-bold text-navy hover:border-navy/30 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${radi ? "animate-spin" : ""}`} aria-hidden /> Osvježi status
              </button>
            ) : null}
          </div>
          {racun.eracun?.dokuId ? (
            <>
              <p className="mt-2">Status razmjene: {eracunBadge(racun.eracun.status)}</p>
              <p className="mt-1">doku ID: <span className="font-mono">{racun.eracun.dokuId}</span></p>
              {racun.eracun.zadnjaProvjera ? (
                <p className="mt-1 text-muted">
                  zadnja provjera: <span className="font-mono">{racun.eracun.zadnjaProvjera.slice(0, 16).replace("T", " ")}</span>
                </p>
              ) : null}
              {racun.eracun.deliveryBlock ? (
                <p className="mt-1 text-opasnost">Dostava blokirana ({racun.eracun.deliveryBlock}) — primatelj nije registriran za eDelivery.</p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-muted">Još nije poslan posredniku.</p>
          )}
          {racun.eracun?.greska ? (
            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-[#F8E2E0] px-3 py-2 text-opasnost">
              {racun.eracun.greska}
            </div>
          ) : null}
        </div>
      ) : null}

      {jeFiskalni ? (
        <div className="mt-5 rounded-xl border border-rub bg-povrsina p-4 text-sm">
          <p className="font-bold">Fiskalizacija</p>
          <p className="mt-1">ZKI: <span className="font-mono">{racun.zki ?? "— (još nije izračunat)"}</span></p>
          <p className="mt-1">
            JIR:{" "}
            {racun.jir ? (
              <span className="font-mono">{racun.jir}</span>
            ) : (
              <em className="text-muted">čeka JIR (naknadna dostava — rok 2 radna dana)</em>
            )}
          </p>
          {racun.fiskalGreska ? <p className="mt-1 text-opasnost">Zadnja greška: {racun.fiskalGreska}</p> : null}
        </div>
      ) : null}

      <p className="mt-5 text-sm text-muted">
        datum: <span className="font-mono">{racun.datumVrijeme.slice(0, 16).replace("T", " ")}</span>
        {" · "}plaćanje: {racun.nacinPlacanja ?? "—"}
        {racun.poslanoEmail ? ` · ✉️ poslano ${racun.poslanoEmail.kada.slice(0, 16)} na ${racun.poslanoEmail.na}` : ""}
      </p>
      {racun.klauzulaPdv ? <p className="mt-2 text-sm italic text-muted">{racun.klauzulaPdv}</p> : null}

      <h2 className="mt-8 text-base font-bold">Stavke</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rub text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Naziv</th>
              <th className="py-2 pr-3">Količina</th>
              <th className="py-2 pr-3">Cijena</th>
              <th className="py-2 pr-3">Popust</th>
              <th className="py-2 pr-3">PDV</th>
            </tr>
          </thead>
          <tbody>
            {racun.stavke.map((s) => (
              <tr key={s.redniBroj} className="border-b border-rub">
                <td className="py-2 pr-3">{s.redniBroj}</td>
                <td className="py-2 pr-3">{s.naziv}</td>
                <td className="py-2 pr-3 font-mono">{s.kolicina} {s.jedinicaMjere}</td>
                <td className="py-2 pr-3 font-mono">{iznosHr(s.netoCijena)}</td>
                <td className="py-2 pr-3 font-mono">{s.popustPosto}%</td>
                <td className="py-2 pr-3 font-mono">{s.pdvStopa}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {racun.iznosi ? (
        <p className="mt-5 text-base">
          <strong>Ukupno: {iznosHr(racun.iznosi.iznosSPdv)} {racun.valuta}</strong>{" "}
          <span className="text-sm text-muted">
            (bez PDV-a {iznosHr(racun.iznosi.iznosBezPdv)}, PDV {iznosHr(racun.iznosi.pdv)})
          </span>
        </p>
      ) : null}
    </>
  );
}

// Badge statusa doku razmjene — FISCALIZED znači da je Porezna prihvatila račun.
function eracunBadge(status: string | null) {
  if (!status) return <em className="text-muted">nepoznat</em>;
  const [boja, naziv] =
    status === "FISCALIZED"
      ? ["bg-[#E0F1E5] text-uspjeh", "Fiskaliziran na Poreznoj upravi"]
      : status === "DELIVERED"
        ? ["bg-[#E0F1E5] text-uspjeh", "Dostavljen primatelju"]
        : status === "IMPORTED"
          ? ["bg-[#E7EEF8] text-[#1D4ED8]", "Zaprimljen kod posrednika"]
          : ["bg-[#ECEFF2] text-muted", status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${boja}`}>
      {status === naziv ? status : `${status} — ${naziv}`}
    </span>
  );
}
