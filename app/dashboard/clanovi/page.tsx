"use client";

// Članovi tenanta — samo vlasnik (backend vraća 403 ostalima). Vlasnik poziva
// knjigovođu ili operatera (pozivnica odmah ide e-mailom; link se uz to prikaže JEDNOM
// kao rezerva), ponovno šalje ili opoziva otvorene pozivnice i deaktivira knjigovođu ili operatera. Vlasnike i sebe ne dira: to radi
// administrator servisa.

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { DashboardLjuska } from "@/components/ljuska";
import { useTenant } from "@/lib/tenant";
import { fiskal, type Clan, type IzdanaPozivnica, type OtvorenaPozivnica } from "@/lib/fiskal";

export default function ClanoviStranica() {
  return (
    <DashboardLjuska>
      <Clanovi />
    </DashboardLjuska>
  );
}

const ULOGE: Record<string, string> = { vlasnik: "vlasnik", knjigovodja: "knjigovođa", operater: "operater" };
const datum = (iso: string) => new Date(iso).toLocaleString("hr-HR", { dateStyle: "medium", timeStyle: "short" });

function Clanovi() {
  const { odabrani } = useTenant();
  const tenantId = odabrani?.tenantId ?? null;
  const [clanovi, setClanovi] = useState<Clan[] | null>(null);
  const [pozivnice, setPozivnice] = useState<OtvorenaPozivnica[]>([]);
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [link, setLink] = useState<(IzdanaPozivnica & { ponovno?: boolean }) | null>(null);
  const [saljem, setSaljem] = useState<number | null>(null);
  const [forma, setForma] = useState({ email: "", ime: "", uloga: "operater" as "knjigovodja" | "operater" });
  const [radi, setRadi] = useState(false);

  const ucitaj = useCallback(async () => {
    if (tenantId == null) return;
    try {
      const r = await fiskal.clanovi(tenantId);
      setClanovi(r.clanovi);
      setPozivnice(r.pozivnice);
    } catch (e) {
      setGreska((e as Error).message);
    }
  }, [tenantId]);

  useEffect(() => {
    setClanovi(null);
    setGreska(null);
    setLink(null);
    void ucitaj();
  }, [ucitaj]);

  if (odabrani && odabrani.uloga !== "vlasnik") {
    return <p className="text-sm text-muted">Članovima firme upravlja samo vlasnik.</p>;
  }

  async function pozovi(e: React.FormEvent) {
    e.preventDefault();
    if (tenantId == null) return;
    setRadi(true);
    setGreska(null);
    setPoruka(null);
    setLink(null);
    try {
      const r = await fiskal.pozovi(tenantId, {
        email: forma.email.trim(),
        ime: forma.ime.trim() || undefined,
        uloga: forma.uloga,
      });
      setLink(r);
      setForma({ email: "", ime: "", uloga: forma.uloga });
      await ucitaj();
    } catch (err) {
      setGreska((err as Error).message);
    } finally {
      setRadi(false);
    }
  }

  async function posaljiPonovno(id: number) {
    if (tenantId == null) return;
    setSaljem(id);
    setGreska(null);
    setPoruka(null);
    setLink(null);
    try {
      setLink({ ...(await fiskal.posaljiPonovno(tenantId, id)), ponovno: true });
      await ucitaj();
    } catch (err) {
      setGreska((err as Error).message);
    } finally {
      setSaljem(null);
    }
  }

  async function radnja(fn: () => Promise<unknown>, uspjeh: string) {
    setGreska(null);
    setPoruka(null);
    try {
      await fn();
      setPoruka(uspjeh);
      await ucitaj();
    } catch (err) {
      setGreska((err as Error).message);
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold">
        Članovi <span className="text-sm font-normal text-muted">— {odabrani?.naziv}</span>
      </h1>
      {greska ? <p className="mt-4 text-sm text-opasnost">{greska}</p> : null}
      {poruka ? <p className="mt-4 text-sm text-uspjeh">{poruka}</p> : null}
      {!clanovi && !greska ? <p className="mt-4 text-sm text-muted">Učitavanje…</p> : null}

      {clanovi ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rub text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-3">Osoba</th>
                <th className="py-2 pr-3">Uloga</th>
                <th className="py-2 pr-3">Stanje</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {clanovi.map((c) => (
                <tr key={c.id} className="border-b border-rub">
                  <td className="py-2.5 pr-3">
                    {c.ime ? <>{c.ime} <span className="text-muted">· {c.email}</span></> : c.email}
                    {c.ja ? <span className="ml-1 text-xs text-muted">(ti)</span> : null}
                  </td>
                  <td className="py-2.5 pr-3">{ULOGE[c.uloga] ?? c.uloga}</td>
                  <td className="py-2.5 pr-3">
                    {!c.aktivan ? (
                      <span className="text-muted">deaktiviran</span>
                    ) : c.korisnikAktivan === false ? (
                      <span className="text-muted">račun deaktiviran</span>
                    ) : c.imaPasskey ? (
                      <span className="text-uspjeh">aktivan</span>
                    ) : (
                      <span className="text-upozorenje">bez passkeya</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {c.aktivan && !c.ja && c.uloga !== "vlasnik" && tenantId != null ? (
                      <button
                        type="button"
                        className="text-xs text-muted hover:text-opasnost"
                        onClick={() => {
                          if (window.confirm(`Deaktivirati ${c.email} u ovoj firmi? Ponovni pristup ide novom pozivnicom.`)) {
                            void radnja(() => fiskal.deaktivirajClana(tenantId, c.id), "Član je deaktiviran.");
                          }
                        }}
                      >
                        Deaktiviraj
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pozivnice.length ? (
        <>
          <h2 className="mt-8 font-semibold">Otvorene pozivnice</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {pozivnice.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3">
                <span>{p.ime ? `${p.ime} · ${p.email}` : p.email}</span>
                <span className="text-muted">
                  {ULOGE[p.uloga] ?? p.uloga} · izdao {p.stvorioTip} · vrijedi do {datum(p.istjece)}
                </span>
                {tenantId != null && p.uloga !== "vlasnik" ? (
                  <button
                    type="button"
                    disabled={saljem != null}
                    title="Nova pozivnica ide mailom; stari link prestaje vrijediti."
                    className="text-xs text-navy hover:text-crvena disabled:opacity-50"
                    onClick={() => void posaljiPonovno(p.id)}
                  >
                    {saljem === p.id ? "Šaljem…" : "Pošalji ponovno"}
                  </button>
                ) : null}
                {tenantId != null ? (
                  <button
                    type="button"
                    className="text-xs text-muted hover:text-opasnost"
                    onClick={() => void radnja(() => fiskal.opozoviPozivnicu(tenantId, p.id), "Pozivnica je opozvana.")}
                  >
                    Opozovi
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <section className="mt-8 max-w-lg rounded-xl border border-rub bg-povrsina p-5">
        <h2 className="font-semibold">Pozovi člana</h2>
        <p className="mt-1 text-sm text-muted">
          Pozivnica odmah ide e-mailom. Link vrijedi 72 sata i jednom; ako mail ne stigne, pošalji ga ponovno.
        </p>
        <form onSubmit={pozovi} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            required
            value={forma.email}
            onChange={(e) => setForma({ ...forma, email: e.target.value })}
            placeholder="e-mail"
            className="rounded-lg border border-rub bg-white px-3 py-2 text-sm focus:border-navy/40 focus:outline-none"
          />
          <input
            value={forma.ime}
            onChange={(e) => setForma({ ...forma, ime: e.target.value })}
            placeholder="ime (neobavezno)"
            className="rounded-lg border border-rub bg-white px-3 py-2 text-sm focus:border-navy/40 focus:outline-none"
          />
          <select
            value={forma.uloga}
            onChange={(e) => setForma({ ...forma, uloga: e.target.value as "knjigovodja" | "operater" })}
            className="rounded-lg border border-rub bg-white px-3 py-2 text-sm"
            aria-label="Uloga"
          >
            <option value="operater">operater (izdaje račune)</option>
            <option value="knjigovodja">knjigovođa (i postavke)</option>
          </select>
          <button
            type="submit"
            disabled={radi}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
          >
            {radi ? "Šaljem…" : "Pošalji pozivnicu"}
          </button>
        </form>
        {link ? (
          <div className="mt-4 rounded-lg border border-rub bg-white p-3 text-sm">
            {link.poslano ? (
              <p>
                Pozivnica {link.ponovno ? "je ponovno poslana" : "je poslana"} na <strong>{link.email}</strong>
                {link.ponovno ? " (stari link više ne vrijedi)" : ""}, vrijedi do {datum(link.istjece)}. Ako zatreba,
                link možeš poslati i sam (prikazuje se samo sada):
              </p>
            ) : (
              <p>
                <span className="text-opasnost">E-mail nije poslan</span>
                {link.emailGreska ? <span className="text-muted"> ({link.emailGreska})</span> : null}. Pozivnica za{" "}
                <strong>{link.email}</strong> ipak vrijedi do {datum(link.istjece)} — kopiraj link i pošalji ga sam:
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <input readOnly value={link.link} className="flex-1 rounded border border-rub px-2 py-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-navy hover:text-crvena"
                onClick={() => void navigator.clipboard.writeText(link.link).then(() => setPoruka("Link je kopiran."))}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden /> Kopiraj
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
