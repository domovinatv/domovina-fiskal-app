"use client";

// Katalog proizvoda (read-only v1 — unos novih proizvoda ide kroz /admin jer
// traži KPD 2025 picker; dashboard ih koristi na „Novi dokument").

import { useEffect, useState } from "react";
import { DashboardLjuska } from "@/components/ljuska";
import { useTenant } from "@/lib/tenant";
import { fiskal, type Proizvod } from "@/lib/fiskal";
import { iznosHr } from "@/lib/format";

export default function ProizvodiStranica() {
  return (
    <DashboardLjuska>
      <Proizvodi />
    </DashboardLjuska>
  );
}

function Proizvodi() {
  const { odabrani } = useTenant();
  const [proizvodi, setProizvodi] = useState<Proizvod[] | null>(null);
  const [greska, setGreska] = useState<string | null>(null);

  useEffect(() => {
    if (!odabrani) return;
    setProizvodi(null);
    setGreska(null);
    fiskal
      .proizvodi(odabrani.tenantId)
      .then((r) => setProizvodi(r.proizvodi))
      .catch((e) => setGreska((e as Error).message));
  }, [odabrani]);

  return (
    <>
      <h1 className="text-xl font-bold">
        Proizvodi <span className="text-sm font-normal text-muted">— {odabrani?.naziv}</span>
      </h1>
      {greska ? <p className="mt-4 text-sm text-opasnost">{greska}</p> : null}
      {!proizvodi && !greska ? <p className="mt-4 text-sm text-muted">Učitavanje…</p> : null}
      {proizvodi ? (
        proizvodi.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rub text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-2 pr-3">Naziv</th>
                  <th className="py-2 pr-3">Šifra</th>
                  <th className="py-2 pr-3">Cijena (neto)</th>
                  <th className="py-2 pr-3">JM</th>
                  <th className="py-2 pr-3">PDV</th>
                  <th className="py-2 pr-3">KPD</th>
                </tr>
              </thead>
              <tbody>
                {proizvodi.map((p) => (
                  <tr key={p.id} className="border-b border-rub">
                    <td className="py-2.5 pr-3">{p.naziv}</td>
                    <td className="py-2.5 pr-3 font-mono">{p.sifra ?? ""}</td>
                    <td className="py-2.5 pr-3 font-mono">{iznosHr(p.netoCijena)}</td>
                    <td className="py-2.5 pr-3 font-mono">{p.jedinicaMjere}</td>
                    <td className="py-2.5 pr-3 font-mono">{p.pdvStopa}% ({p.pdvKategorija})</td>
                    <td className="py-2.5 pr-3 font-mono">{p.kpd ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-sm italic text-muted">Katalog je prazan.</p>
        )
      ) : null}
      <p className="mt-6 text-xs text-muted">
        Novi proizvodi se za sada dodaju kroz administratora servisa (unos traži KPD 2025
        šifrarnik) — na „Novi dokument" možeš uvijek upisati i slobodnu stavku.
      </p>
    </>
  );
}
