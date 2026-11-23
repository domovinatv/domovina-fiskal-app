"use client";

// Moji passkeyi: popis, dodavanje (samo uz svježu prijavu, server kaže razlog ako
// ne smije) i brisanje (zadnji se ne može obrisati — server vraća 409).

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { DashboardLjuska } from "@/components/ljuska";
import { useAuth } from "@/lib/auth";
import { fiskal, type MojPasskey } from "@/lib/fiskal";
import { dodajPasskey, porukaGreske } from "@/lib/passkey";

export default function PasskeyiStranica() {
  return (
    <DashboardLjuska>
      <Passkeyi />
    </DashboardLjuska>
  );
}

const datum = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("hr-HR", { dateStyle: "medium", timeStyle: "short" }) : "—";

const METODE: Record<string, string> = { passkey: "passkeyem", poziv: "pozivnicom" };

function Passkeyi() {
  const { ja } = useAuth();
  const [passkeyi, setPasskeyi] = useState<MojPasskey[] | null>(null);
  const [dodavanje, setDodavanje] = useState<string | null>(null);
  const [oznaka, setOznaka] = useState("");
  const [radi, setRadi] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);

  const ucitaj = useCallback(async () => {
    try {
      const r = await fiskal.passkeyi();
      setPasskeyi(r.passkeyi);
      setDodavanje(r.dodavanje);
    } catch (e) {
      setGreska((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void ucitaj();
  }, [ucitaj]);

  async function dodaj(e: React.FormEvent) {
    e.preventDefault();
    setRadi(true);
    setGreska(null);
    setPoruka(null);
    try {
      await dodajPasskey(oznaka.trim());
      setOznaka("");
      setPoruka("Passkey je dodan.");
      await ucitaj();
    } catch (err) {
      setGreska(porukaGreske(err, "izrada").replace(" Pozivnica nije potrošena —", ""));
    } finally {
      setRadi(false);
    }
  }

  async function obrisi(p: MojPasskey) {
    if (!window.confirm(`Obrisati passkey „${p.oznaka || "bez naziva"}”? Tim uređajem se više nećeš moći prijaviti.`)) return;
    setGreska(null);
    setPoruka(null);
    try {
      await fiskal.obrisiPasskey(p.id);
      setPoruka("Passkey je obrisan.");
      await ucitaj();
    } catch (err) {
      setGreska((err as Error).message);
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold">Moji passkeyi</h1>
      {ja ? (
        <p className="mt-1 text-sm text-muted">
          {ja.ime ? `${ja.ime} · ` : ""}
          {ja.email} · prijavljen/a {METODE[ja.prijava.metoda] ?? ja.prijava.metoda} {datum(ja.prijava.od)}, sesija
          vrijedi do {datum(ja.prijava.do)}
        </p>
      ) : null}

      {greska ? <p className="mt-4 text-sm text-opasnost">{greska}</p> : null}
      {poruka ? <p className="mt-4 text-sm text-uspjeh">{poruka}</p> : null}
      {!passkeyi && !greska ? <p className="mt-4 text-sm text-muted">Učitavanje…</p> : null}

      {passkeyi ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rub text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-3">Naziv</th>
                <th className="py-2 pr-3">Dodan</th>
                <th className="py-2 pr-3">Zadnje korišten</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {passkeyi.map((p) => (
                <tr key={p.id} className="border-b border-rub">
                  <td className="py-2.5 pr-3">{p.oznaka || <span className="text-muted">bez naziva</span>}</td>
                  <td className="py-2.5 pr-3">{datum(p.stvoren)}</td>
                  <td className="py-2.5 pr-3">{datum(p.zadnjeKoristen)}</td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => void obrisi(p)}
                      disabled={passkeyi.length < 2}
                      title={passkeyi.length < 2 ? "Zadnji passkey se ne može obrisati — prvo dodaj drugi." : "Obriši"}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-opasnost disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Obriši
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <section className="mt-8 max-w-md rounded-xl border border-rub bg-povrsina p-5">
        <h2 className="font-semibold">Dodaj passkey</h2>
        <p className="mt-1 text-sm text-muted">
          Drugi uređaj ili upravitelj lozinki, da ne ostaneš bez pristupa ako izgubiš jedan.
        </p>
        {dodavanje ? (
          <p className="mt-3 text-sm text-upozorenje">{dodavanje}</p>
        ) : (
          <form onSubmit={dodaj} className="mt-3 space-y-3">
            <input
              value={oznaka}
              onChange={(e) => setOznaka(e.target.value)}
              maxLength={60}
              placeholder="Naziv uređaja, npr. Mobitel"
              className="w-full rounded-lg border border-rub bg-white px-3 py-2 text-sm focus:border-navy/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={radi}
              className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" aria-hidden /> {radi ? "Čekam passkey…" : "Dodaj passkey"}
            </button>
          </form>
        )}
      </section>
    </>
  );
}
