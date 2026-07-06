"use client";

// Popis računa odabranog tenanta + brze akcije.

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { DashboardLjuska } from "@/components/ljuska";
import { useTenant } from "@/lib/tenant";
import { fiskal, type RacunSazetak } from "@/lib/fiskal";
import { iznosHr, statusPilula, tipNaziv } from "@/lib/format";

export default function DashboardStranica() {
  return (
    <DashboardLjuska>
      <PopisRacuna />
    </DashboardLjuska>
  );
}

function PopisRacuna() {
  const { odabrani } = useTenant();
  const [racuni, setRacuni] = useState<RacunSazetak[] | null>(null);
  const [greska, setGreska] = useState<string | null>(null);

  useEffect(() => {
    if (!odabrani) return;
    setRacuni(null);
    setGreska(null);
    fiskal
      .racuni(odabrani.tenantId)
      .then((r) => setRacuni(r.racuni))
      .catch((e) => setGreska((e as Error).message));
  }, [odabrani]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Dokumenti <span className="text-sm font-normal text-muted">— {odabrani?.naziv}</span>
        </h1>
        <Link
          href="/dashboard/novi"
          className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-[#013a86]"
        >
          <Plus className="h-4 w-4" aria-hidden /> Novi dokument
        </Link>
      </div>

      {greska ? <p className="mt-6 text-sm text-opasnost">{greska}</p> : null}
      {!racuni && !greska ? <p className="mt-6 text-sm text-muted">Učitavanje…</p> : null}

      {racuni ? (
        racuni.length ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rub text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-2 pr-3">Broj</th>
                  <th className="py-2 pr-3">Tip</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Iznos</th>
                  <th className="py-2 pr-3">Datum</th>
                </tr>
              </thead>
              <tbody>
                {racuni.map((r) => (
                  <tr key={r.id} className="border-b border-rub hover:bg-povrsina">
                    <td className="py-2.5 pr-3 font-mono">
                      <Link href={`/dashboard/racun?id=${r.id}`} className="flex items-center gap-1.5 text-navy underline-offset-2 hover:underline">
                        <FileText className="h-3.5 w-3.5 text-muted" aria-hidden />
                        {r.brojRacuna ?? `#${r.id} (skica)`}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">{tipNaziv(r.tip)}</td>
                    <td className="py-2.5 pr-3">{statusPilula(r.status)}</td>
                    <td className="py-2.5 pr-3 font-mono">{iznosHr(r.iznosSPdv)} {r.valuta}</td>
                    <td className="py-2.5 pr-3 font-mono text-muted">{r.datumVrijeme.slice(0, 16).replace("T", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-8 text-sm italic text-muted">Još nema dokumenata — kreni s „Novi dokument".</p>
        )
      ) : null}
    </>
  );
}
