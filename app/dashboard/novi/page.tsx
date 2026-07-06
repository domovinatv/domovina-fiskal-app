"use client";

// Novi dokument: prostor/uređaj/operater iz GET /postavke, stavke iz kataloga
// (GET /proizvod) ili slobodne. Nakon uspjeha → detalj dokumenta.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { DashboardLjuska } from "@/components/ljuska";
import { useTenant } from "@/lib/tenant";
import { fiskal, FiskalGreska, type NoviRacunPayload, type Postavke, type Proizvod } from "@/lib/fiskal";

interface Stavka {
  proizvodId: string; // '' = slobodna stavka
  naziv: string;
  kolicina: string;
  jedinicaMjere: string;
  netoCijena: string;
  popustPosto: string;
  pdvStopa: string;
}

const PRAZNA_STAVKA: Stavka = {
  proizvodId: "",
  naziv: "",
  kolicina: "1",
  jedinicaMjere: "H87",
  netoCijena: "",
  popustPosto: "0",
  pdvStopa: "25",
};

export default function NoviDokumentStranica() {
  return (
    <DashboardLjuska>
      <NoviDokument />
    </DashboardLjuska>
  );
}

function NoviDokument() {
  const { odabrani } = useTenant();
  const router = useRouter();
  const [postavke, setPostavke] = useState<Postavke | null>(null);
  const [proizvodi, setProizvodi] = useState<Proizvod[]>([]);
  const [greska, setGreska] = useState<string | null>(null);
  const [radi, setRadi] = useState(false);

  const [tip, setTip] = useState<NoviRacunPayload["tip"]>("RACUN");
  const [ppNu, setPpNu] = useState(""); // "PP|NU"
  const [operater, setOperater] = useState("");
  const [nacin, setNacin] = useState("TRANSAKCIJSKI");
  const [kupacNaziv, setKupacNaziv] = useState("");
  const [kupacOib, setKupacOib] = useState("");
  const [kupacEmail, setKupacEmail] = useState("");
  const [napomena, setNapomena] = useState("");
  const [stavke, setStavke] = useState<Stavka[]>([{ ...PRAZNA_STAVKA }]);

  useEffect(() => {
    if (!odabrani) return;
    setPostavke(null);
    setGreska(null);
    Promise.all([fiskal.postavke(odabrani.tenantId), fiskal.proizvodi(odabrani.tenantId)])
      .then(([p, pr]) => {
        setPostavke(p);
        setProizvodi(pr.proizvodi.filter((x) => x.aktivan));
        const prviUredjaj = p.uredjaji.find((u) => u.aktivan);
        if (prviUredjaj) setPpNu(`${prviUredjaj.prostorOznaka}|${prviUredjaj.oznaka}`);
      })
      .catch((e) => setGreska((e as Error).message));
  }, [odabrani]);

  function postaviStavku(i: number, izmjena: Partial<Stavka>) {
    setStavke((prev) => prev.map((s, j) => (j === i ? { ...s, ...izmjena } : s)));
  }

  function odaberiProizvod(i: number, id: string) {
    const p = proizvodi.find((x) => String(x.id) === id);
    if (!p) {
      postaviStavku(i, { proizvodId: "" });
      return;
    }
    postaviStavku(i, {
      proizvodId: id,
      naziv: p.naziv,
      jedinicaMjere: p.jedinicaMjere,
      netoCijena: p.netoCijena,
      pdvStopa: p.pdvStopa,
    });
  }

  async function posalji(status: "nacrt" | "izdano") {
    if (!odabrani) return;
    const [pp, nu] = ppNu.split("|");
    if (!pp || !nu) {
      setGreska("Odaberi poslovni prostor / naplatni uređaj.");
      return;
    }
    setRadi(true);
    setGreska(null);
    try {
      const payload: NoviRacunPayload = {
        tip,
        poslovniProstor: pp,
        naplatniUredaj: nu,
        ...(operater ? { operaterOib: operater } : {}),
        nacinPlacanja: nacin,
        ...(napomena.trim() ? { napomena: napomena.trim() } : {}),
        ...(kupacNaziv.trim()
          ? {
              kupac: {
                naziv: kupacNaziv.trim(),
                ...(kupacOib.trim() ? { oib: kupacOib.trim() } : {}),
                ...(kupacEmail.trim() ? { email: kupacEmail.trim() } : {}),
              },
            }
          : {}),
        stavke: stavke
          .filter((s) => s.naziv.trim() || s.proizvodId)
          .map((s) => ({
            ...(s.proizvodId ? { proizvodId: Number(s.proizvodId) } : {}),
            ...(s.naziv.trim() ? { naziv: s.naziv.trim() } : {}),
            kolicina: s.kolicina || "1",
            jedinicaMjere: s.jedinicaMjere || "H87",
            ...(s.netoCijena ? { netoCijena: s.netoCijena } : {}),
            popustPosto: s.popustPosto || "0",
            ...(s.pdvStopa ? { pdvStopa: s.pdvStopa } : {}),
          })),
        status,
      };
      const r = await fiskal.noviRacun(odabrani.tenantId, payload);
      router.push(`/dashboard/racun?id=${r.id}`);
    } catch (e) {
      const fe = e as FiskalGreska;
      setGreska(fe.detalji?.length ? `${fe.message} — ${fe.detalji.map((d) => `${d.polje}: ${d.poruka}`).join(" · ")}` : fe.message);
      setRadi(false);
    }
  }

  if (greska && !postavke) return <p className="text-sm text-opasnost">{greska}</p>;
  if (!postavke) return <p className="text-sm text-muted">Učitavanje…</p>;

  const aktivniUredjaji = postavke.uredjaji.filter((u) => u.aktivan);
  const aktivniOperateri = postavke.operateri.filter((o) => o.aktivan);
  const pdvStope = postavke.tenant.uSustavuPdv ? ["25", "13", "5", "0"] : ["0"];

  return (
    <>
      <h1 className="text-xl font-bold">Novi dokument</h1>
      {greska ? <p className="mt-3 rounded-lg bg-[#F8E2E0] px-4 py-2 text-sm text-opasnost">{greska}</p> : null}

      <div className="mt-5 grid gap-4 rounded-xl border border-rub bg-povrsina p-4 sm:grid-cols-3">
        <Polje naziv="Vrsta *">
          <select value={tip} onChange={(e) => setTip(e.target.value as NoviRacunPayload["tip"])} className={ulazKlasa}>
            <option value="RACUN">Račun</option>
            <option value="PONUDA">Ponuda</option>
            <option value="PREDRACUN">Predračun</option>
            <option value="FISKALNI_B2C">Fiskalni B2C (ZKI/JIR)</option>
          </select>
        </Polje>
        <Polje naziv="Prostor / uređaj *">
          <select value={ppNu} onChange={(e) => setPpNu(e.target.value)} className={ulazKlasa}>
            {aktivniUredjaji.map((u) => (
              <option key={u.id} value={`${u.prostorOznaka}|${u.oznaka}`}>
                {u.prostorOznaka} / {u.oznaka}{u.opis ? ` — ${u.opis}` : ""}
              </option>
            ))}
          </select>
        </Polje>
        <Polje naziv="Operater (obavezan za fiskalni)">
          <select value={operater} onChange={(e) => setOperater(e.target.value)} className={ulazKlasa}>
            <option value="">—</option>
            {aktivniOperateri.map((o) => (
              <option key={o.id} value={o.oib}>{o.ime ?? o.oib}</option>
            ))}
          </select>
        </Polje>
        <Polje naziv="Način plaćanja">
          <select value={nacin} onChange={(e) => setNacin(e.target.value)} className={ulazKlasa}>
            <option value="TRANSAKCIJSKI">transakcijski</option>
            <option value="KARTICA">kartica</option>
            <option value="GOTOVINA">gotovina</option>
            <option value="OSTALO">ostalo</option>
          </select>
        </Polje>
        <Polje naziv="Kupac (naziv)">
          <input value={kupacNaziv} onChange={(e) => setKupacNaziv(e.target.value)} placeholder="prazno = krajnji kupac" className={ulazKlasa} />
        </Polje>
        <Polje naziv="OIB kupca">
          <input value={kupacOib} onChange={(e) => setKupacOib(e.target.value)} pattern="\d{11}" className={ulazKlasa} />
        </Polje>
        <Polje naziv="Email kupca">
          <input type="email" value={kupacEmail} onChange={(e) => setKupacEmail(e.target.value)} className={ulazKlasa} />
        </Polje>
        <Polje naziv="Napomena (na PDF-u)">
          <input value={napomena} onChange={(e) => setNapomena(e.target.value)} className={ulazKlasa} />
        </Polje>
      </div>

      <h2 className="mt-6 text-base font-bold">Stavke</h2>
      <div className="mt-3 space-y-3">
        {stavke.map((s, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-rub p-3 sm:grid-cols-8">
            <select value={s.proizvodId} onChange={(e) => odaberiProizvod(i, e.target.value)} className={`${ulazKlasa} sm:col-span-2`} aria-label="Proizvod iz kataloga">
              <option value="">— slobodna stavka —</option>
              {proizvodi.map((p) => (
                <option key={p.id} value={p.id}>{p.naziv}</option>
              ))}
            </select>
            <input value={s.naziv} onChange={(e) => postaviStavku(i, { naziv: e.target.value })} placeholder="Naziv *" className={`${ulazKlasa} sm:col-span-2`} />
            <input value={s.kolicina} onChange={(e) => postaviStavku(i, { kolicina: e.target.value })} placeholder="Kol." className={ulazKlasa} aria-label="Količina" />
            <input value={s.netoCijena} onChange={(e) => postaviStavku(i, { netoCijena: e.target.value })} placeholder="Cijena *" className={ulazKlasa} aria-label="Neto cijena" />
            <select value={s.pdvStopa} onChange={(e) => postaviStavku(i, { pdvStopa: e.target.value })} className={ulazKlasa} aria-label="PDV stopa">
              {pdvStope.map((st) => (
                <option key={st} value={st}>{st}%</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setStavke((prev) => prev.filter((_, j) => j !== i))}
              disabled={stavke.length === 1}
              className="flex items-center justify-center rounded-lg border border-rub text-muted hover:text-opasnost disabled:opacity-30"
              aria-label="Ukloni stavku"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setStavke((prev) => [...prev, { ...PRAZNA_STAVKA, pdvStopa: pdvStope[0] ?? "25" }])}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-rub px-3 py-2 text-sm font-semibold text-muted hover:text-navy"
      >
        <Plus className="h-4 w-4" aria-hidden /> stavka
      </button>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          disabled={radi}
          onClick={() => void posalji("izdano")}
          className="rounded-lg bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-[#013a86] disabled:opacity-50"
        >
          {radi ? "Slanje…" : "Izdaj dokument"}
        </button>
        <button
          type="button"
          disabled={radi}
          onClick={() => void posalji("nacrt")}
          className="rounded-lg bg-muted px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          Spremi kao skicu
        </button>
      </div>
    </>
  );
}

const ulazKlasa =
  "rounded-lg border border-rub bg-white px-3 py-2 text-sm focus:border-navy/40 focus:outline-none w-full";

function Polje({ naziv, children }: { naziv: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{naziv}</span>
      {children}
    </label>
  );
}
