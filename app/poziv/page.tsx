"use client";

// Pozivnica: /app/poziv#<token>. Token je u fragmentu, pa ne ide na server u URL-u,
// u log ni u Referer; šaljemo ga samo u tijelu POST-a. Odmah po čitanju brišemo ga
// iz adrese (history.replaceState), da ne ostane u povijesti ni na dijeljenom ekranu.
// Opcije se dohvate odmah (prikaz e-maila i firme), a passkey nastaje tek na klik,
// da preglednik vidi korisnikovu gestu izravno prije navigator.credentials.create.
// Ako račun s tim e-mailom već ima passkey (npr. pozivnica u drugu firmu), glavna radnja je
// prijava postojećim passkeyem (/poziv/prijava): novi ključ ne nastaje, pozivnica se potroši.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/fiskal";
import { PomocPasskey, useAuth } from "@/lib/auth";
import { izradiPasskey, podrzan, porukaGreske, prihvatiPrijavom } from "@/lib/passkey";

interface PozivOpcije {
  opcije: PublicKeyCredentialCreationOptionsJSON;
  imaPasskey: boolean;
  email: string;
  ime: string | null;
  tenant: { id: number; naziv: string | null } | null;
  uloga: string | null;
  noviPasskey: boolean;
}

const ULOGE: Record<string, string> = { vlasnik: "vlasnik", knjigovodja: "knjigovođa", operater: "operater" };

type Stanje =
  | { vrsta: "ucitavanje" }
  | { vrsta: "nepotpun" }
  | { vrsta: "ne_vrijedi" }
  | { vrsta: "spremno"; poziv: PozivOpcije };

export default function PozivStranica() {
  const router = useRouter();
  const { osvjezi } = useAuth();
  const token = useRef<string>("");
  const [stanje, setStanje] = useState<Stanje>({ vrsta: "ucitavanje" });
  const [oznaka, setOznaka] = useState("");
  const [radi, setRadi] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);

  async function ucitaj() {
    try {
      const p = await api<PozivOpcije>("/poziv/opcije", { metoda: "POST", tijelo: { token: token.current } });
      setStanje({ vrsta: "spremno", poziv: p });
    } catch {
      // Server namjerno ne kaže razlog (istekla, iskorištena, opozvana, kriv token).
      setStanje({ vrsta: "ne_vrijedi" });
    }
  }

  useEffect(() => {
    token.current = window.location.hash.slice(1);
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (!token.current) setStanje({ vrsta: "nepotpun" });
    else void ucitaj();
  }, []);

  async function izradi() {
    if (stanje.vrsta !== "spremno") return;
    setRadi(true);
    setGreska(null);
    try {
      const odgovor = await izradiPasskey(stanje.poziv.opcije);
      await api("/poziv/potvrdi", {
        metoda: "POST",
        tijelo: { token: token.current, odgovor, oznaka: oznaka.trim() },
      });
      await osvjezi();
      router.replace("/dashboard");
    } catch (e) {
      setGreska(porukaGreske(e, "izrada"));
      setRadi(false);
      // Izazov je potrošen ili je istekao: nove opcije za sljedeći pokušaj.
      void ucitaj();
    }
  }

  async function prijava() {
    if (stanje.vrsta !== "spremno") return;
    setRadi(true);
    setGreska(null);
    try {
      await prihvatiPrijavom(token.current);
      await osvjezi();
      router.replace("/dashboard");
    } catch (e) {
      setGreska(porukaGreske(e, "prijava"));
      setRadi(false);
      void ucitaj();
    }
  }

  const obrazacIzrade = (
    <>
      <label className="mt-5 block text-sm">
        <span className="font-semibold">Naziv uređaja (neobavezno)</span>
        <input
          value={oznaka}
          onChange={(e) => setOznaka(e.target.value)}
          maxLength={60}
          placeholder="npr. Laptop u uredu"
          className="mt-1 w-full rounded-lg border border-rub px-3 py-2 text-sm focus:border-navy/40 focus:outline-none"
        />
      </label>
      <button
        type="button"
        onClick={() => void izradi()}
        disabled={radi || !podrzan()}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
      >
        <KeyRound className="h-4 w-4" aria-hidden /> {radi ? "Čekam passkey…" : "Izradi passkey i uđi"}
      </button>
    </>
  );

  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-rub bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold text-navy">Pozivnica u DOMOVINA Fiskal</h1>

      {stanje.vrsta === "ucitavanje" ? <p className="mt-4 text-sm text-muted">Provjeravam pozivnicu…</p> : null}

      {stanje.vrsta === "nepotpun" ? (
        <>
          <p className="mt-4 font-semibold text-opasnost">Link nije potpun</p>
          <p className="mt-2 text-sm text-muted">
            Otvori cijeli link iz poruke, zajedno s dijelom iza znaka #. Ako si ga već otvorio/la
            ovdje, otvori ga ponovno iz poruke.
          </p>
        </>
      ) : null}

      {stanje.vrsta === "ne_vrijedi" ? (
        <>
          <p className="mt-4 font-semibold text-opasnost">Pozivnica ne vrijedi</p>
          <p className="mt-2 text-sm text-muted">
            Istekla je, već je iskorištena ili je opozvana. Zatraži novu od osobe koja te pozvala.
            Ako već imaš passkey, <Link href="/dashboard" className="text-navy underline">prijavi se</Link>.
          </p>
        </>
      ) : null}

      {stanje.vrsta === "spremno" ? (
        <>
          <p className="mt-3 text-sm text-muted">
            {stanje.poziv.noviPasskey ? "Novi passkey za račun " : "Pozvan/a si kao "}
            <strong className="text-navy">{stanje.poziv.ime || stanje.poziv.email}</strong>
            {stanje.poziv.ime ? <> ({stanje.poziv.email})</> : null}
            {stanje.poziv.tenant ? (
              <>
                {" "}u firmu <strong className="text-navy">{stanje.poziv.tenant.naziv ?? `#${stanje.poziv.tenant.id}`}</strong>
                {stanje.poziv.uloga ? <>, uloga {ULOGE[stanje.poziv.uloga] ?? stanje.poziv.uloga}</> : null}
              </>
            ) : null}
            .
          </p>
          <p className="mt-3 text-sm text-muted">
            Prijava ide passkeyem: otiskom prsta, licem, PIN-om uređaja ili upraviteljem lozinki.
            Lozinke nema.
          </p>
          {stanje.poziv.imaPasskey && !stanje.poziv.noviPasskey ? (
            <>
              <p className="mt-3 text-sm text-muted">
                Već imaš passkey za ovaj račun — prijavi se njime i pozivnica je prihvaćena.
              </p>
              <button
                type="button"
                onClick={() => void prijava()}
                disabled={radi || !podrzan()}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" aria-hidden /> {radi ? "Čekam passkey…" : "Prijavi se postojećim passkeyem"}
              </button>
              <details className="mt-4 text-sm text-muted">
                <summary className="cursor-pointer">Želim izraditi novi passkey na ovom uređaju</summary>
                {obrazacIzrade}
              </details>
            </>
          ) : (
            <>
              {obrazacIzrade}
              {!stanje.poziv.noviPasskey ? (
                <button
                  type="button"
                  onClick={() => void prijava()}
                  disabled={radi || !podrzan()}
                  className="mt-3 w-full text-center text-sm text-navy underline hover:text-crvena disabled:opacity-50"
                >
                  Već imam passkey — prijavi se postojećim passkeyem
                </button>
              ) : null}
            </>
          )}
          {!podrzan() ? (
            <p className="mt-4 text-sm text-opasnost">Ovaj preglednik ne podržava passkeye. Otvori link u novijem Chromeu, Safariju, Edgeu ili Firefoxu.</p>
          ) : null}
          {greska ? <p className="mt-4 text-sm text-opasnost">{greska}</p> : null}
          <PomocPasskey />
        </>
      ) : null}
    </div>
  );
}
