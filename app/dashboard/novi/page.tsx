"use client";

// Novi dokument: prostor/uređaj/operater iz GET /postavke, stavke iz kataloga
// (GET /proizvod) ili slobodne. Nakon uspjeha → detalj dokumenta.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { DashboardLjuska } from "@/components/ljuska";
import { useTenant } from "@/lib/tenant";
import { fiskal, FiskalGreska, type KpdStavka, type NoviRacunPayload, type Postavke, type Proizvod } from "@/lib/fiskal";

interface Stavka {
  proizvodId: string; // '' = slobodna stavka
  naziv: string;
  kolicina: string;
  jedinicaMjere: string;
  netoCijena: string;
  popustPosto: string;
  pdvStopa: string;
  kpd: string; // KPD 2025 šifra (NN.NN.NN) — obavezna za eRačun
}

const PRAZNA_STAVKA: Stavka = {
  proizvodId: "",
  naziv: "",
  kolicina: "1",
  jedinicaMjere: "H87",
  netoCijena: "",
  popustPosto: "0",
  pdvStopa: "25",
  kpd: "",
};

// Stanje inline AMS provjere primatelja (je li OIB registriran za eDelivery).
type AmsStanje =
  | { stanje: "provjera" }
  | { stanje: "registriran" }
  | { stanje: "neregistriran" }
  | { stanje: "greska"; poruka: string };

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
  const [kupacUlica, setKupacUlica] = useState("");
  const [kupacGrad, setKupacGrad] = useState("");
  const [kupacPbr, setKupacPbr] = useState("");
  const [datumDospijeca, setDatumDospijeca] = useState("");
  const [napomena, setNapomena] = useState("");
  const [stavke, setStavke] = useState<Stavka[]>([{ ...PRAZNA_STAVKA }]);
  const [ams, setAms] = useState<AmsStanje | null>(null);

  const jeEracun = tip === "ERACUN_B2B" || tip === "ERACUN_B2G";

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

  // Inline AMS provjera primatelja — čim je OIB potpun (11 znamenki) i tip eRačun.
  useEffect(() => {
    const oib = kupacOib.trim();
    if (!jeEracun || !odabrani || !/^\d{11}$/.test(oib)) {
      setAms(null);
      return;
    }
    setAms({ stanje: "provjera" });
    const t = setTimeout(() => {
      fiskal
        .provjeriPrimatelja(odabrani.tenantId, oib)
        .then((r) => setAms(r.registriran ? { stanje: "registriran" } : { stanje: "neregistriran" }))
        .catch((e) => setAms({ stanje: "greska", poruka: (e as Error).message }));
    }, 400);
    return () => clearTimeout(t);
  }, [jeEracun, odabrani, kupacOib]);

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
      kpd: p.kpd ?? "",
    });
  }

  async function posalji(status: "nacrt" | "izdano") {
    if (!odabrani) return;
    const [pp, nu] = ppNu.split("|");
    if (!pp || !nu) {
      setGreska("Odaberi poslovni prostor / naplatni uređaj.");
      return;
    }
    const aktivneStavke = stavke.filter((s) => s.naziv.trim() || s.proizvodId);
    if (jeEracun) {
      // Backend guardovi (HR CIUS 2025) — spriječi unaprijed umjesto 400 s Porezne.
      const problemi: string[] = [];
      if (!kupacNaziv.trim()) problemi.push("naziv kupca je obavezan");
      if (!/^\d{11}$/.test(kupacOib.trim())) problemi.push("OIB kupca mora imati 11 znamenki");
      if (!kupacUlica.trim() || !kupacGrad.trim() || !kupacPbr.trim())
        problemi.push("adresa kupca (ulica, grad, poštanski broj) je obavezna");
      if (!operater) problemi.push("operater je obavezan");
      if (aktivneStavke.some((s) => !s.kpd.trim())) problemi.push("KPD šifra je obavezna za svaku stavku");
      if (problemi.length) {
        setGreska(`eRačun: ${problemi.join(" · ")}.`);
        return;
      }
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
        ...(datumDospijeca ? { datumDospijeca } : {}),
        ...(napomena.trim() ? { napomena: napomena.trim() } : {}),
        ...(kupacNaziv.trim()
          ? {
              kupac: {
                naziv: kupacNaziv.trim(),
                ...(kupacOib.trim() ? { oib: kupacOib.trim() } : {}),
                ...(kupacEmail.trim() ? { email: kupacEmail.trim() } : {}),
                ...(kupacUlica.trim() || kupacGrad.trim() || kupacPbr.trim()
                  ? {
                      adresa: {
                        ...(kupacUlica.trim() ? { ulica: kupacUlica.trim() } : {}),
                        ...(kupacGrad.trim() ? { grad: kupacGrad.trim() } : {}),
                        ...(kupacPbr.trim() ? { postanskiBroj: kupacPbr.trim() } : {}),
                        drzava: "HR",
                      },
                    }
                  : {}),
              },
            }
          : {}),
        stavke: aktivneStavke.map((s) => ({
          ...(s.proizvodId ? { proizvodId: Number(s.proizvodId) } : {}),
          ...(s.naziv.trim() ? { naziv: s.naziv.trim() } : {}),
          kolicina: s.kolicina || "1",
          jedinicaMjere: s.jedinicaMjere || "H87",
          ...(s.netoCijena ? { netoCijena: s.netoCijena } : {}),
          popustPosto: s.popustPosto || "0",
          ...(s.pdvStopa ? { pdvStopa: s.pdvStopa } : {}),
          ...(s.kpd.trim() ? { kpd: s.kpd.trim() } : {}),
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
  if (!postavke || !odabrani) return <p className="text-sm text-muted">Učitavanje…</p>;

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
            <option value="ERACUN_B2B">eRačun (B2B)</option>
            <option value="ERACUN_B2G">eRačun (B2G)</option>
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
        <Polje naziv={jeEracun ? "Operater *" : "Operater (obavezan za fiskalni)"}>
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
        <Polje naziv="Datum dospijeća">
          <input type="date" value={datumDospijeca} onChange={(e) => setDatumDospijeca(e.target.value)} className={ulazKlasa} />
        </Polje>
        <Polje naziv={jeEracun ? "Kupac (naziv) *" : "Kupac (naziv)"}>
          <input value={kupacNaziv} onChange={(e) => setKupacNaziv(e.target.value)} placeholder={jeEracun ? undefined : "prazno = krajnji kupac"} className={ulazKlasa} />
        </Polje>
        <Polje naziv={jeEracun ? "OIB kupca *" : "OIB kupca"}>
          <input value={kupacOib} onChange={(e) => setKupacOib(e.target.value)} pattern="\d{11}" className={ulazKlasa} />
          {jeEracun && ams ? <AmsStatus ams={ams} /> : null}
        </Polje>
        <Polje naziv="Email kupca">
          <input type="email" value={kupacEmail} onChange={(e) => setKupacEmail(e.target.value)} className={ulazKlasa} />
        </Polje>
        {jeEracun ? (
          <>
            <Polje naziv="Ulica kupca *">
              <input value={kupacUlica} onChange={(e) => setKupacUlica(e.target.value)} className={ulazKlasa} />
            </Polje>
            <Polje naziv="Grad kupca *">
              <input value={kupacGrad} onChange={(e) => setKupacGrad(e.target.value)} className={ulazKlasa} />
            </Polje>
            <Polje naziv="Poštanski broj kupca *">
              <input value={kupacPbr} onChange={(e) => setKupacPbr(e.target.value)} className={ulazKlasa} />
            </Polje>
          </>
        ) : null}
        <Polje naziv="Napomena (na PDF-u)">
          <input value={napomena} onChange={(e) => setNapomena(e.target.value)} className={ulazKlasa} />
        </Polje>
      </div>

      <h2 className="mt-6 text-base font-bold">Stavke</h2>
      <div className="mt-3 space-y-3">
        {stavke.map((s, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-rub p-3 sm:grid-cols-9">
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
            <KpdAutocomplete
              tenantId={odabrani.tenantId}
              vrijednost={s.kpd}
              obavezno={jeEracun}
              onPromjena={(kpd) => postaviStavku(i, { kpd })}
            />
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

// Indikator AMS provjere ispod OIB polja — je li primatelj registriran za eDelivery.
function AmsStatus({ ams }: { ams: AmsStanje }) {
  if (ams.stanje === "provjera")
    return (
      <span className="flex items-center gap-1 text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> provjera primatelja…
      </span>
    );
  if (ams.stanje === "registriran")
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-uspjeh">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> primatelj registriran za eDelivery
      </span>
    );
  if (ams.stanje === "neregistriran")
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-opasnost">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> primatelj NIJE registriran za eDelivery — dostava neće proći (AMS)
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-opasnost">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> provjera nije uspjela: {ams.poruka}
    </span>
  );
}

// KPD 2025 autocomplete — pretraga šifrarnika po nazivu ili šifri (GET /kpd?q=).
function KpdAutocomplete({
  tenantId,
  vrijednost,
  obavezno,
  onPromjena,
}: {
  tenantId: number;
  vrijednost: string;
  obavezno: boolean;
  onPromjena: (kpd: string) => void;
}) {
  const [prijedlozi, setPrijedlozi] = useState<KpdStavka[]>([]);
  const [otvoren, setOtvoren] = useState(false);

  useEffect(() => {
    const q = vrijednost.trim();
    if (!otvoren || q.length < 2) {
      setPrijedlozi([]);
      return;
    }
    const t = setTimeout(() => {
      fiskal
        .kpdTrazi(tenantId, q)
        .then((r) => setPrijedlozi(r.rezultati))
        .catch(() => setPrijedlozi([]));
    }, 300);
    return () => clearTimeout(t);
  }, [tenantId, vrijednost, otvoren]);

  return (
    <div className="relative">
      <input
        value={vrijednost}
        onChange={(e) => {
          onPromjena(e.target.value);
          setOtvoren(true);
        }}
        onFocus={() => setOtvoren(true)}
        onBlur={() => setOtvoren(false)}
        placeholder={obavezno ? "KPD *" : "KPD"}
        className={ulazKlasa}
        aria-label="KPD šifra"
      />
      {otvoren && prijedlozi.length ? (
        <ul className="absolute right-0 z-10 mt-1 max-h-56 w-80 overflow-auto rounded-lg border border-rub bg-white shadow-lg">
          {prijedlozi.map((p) => (
            <li key={p.sifra}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault() /* ne gubi fokus prije klika */}
                onClick={() => {
                  onPromjena(p.sifra);
                  setOtvoren(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-povrsina"
              >
                <span className="font-mono font-bold">{p.sifra}</span> {p.naziv}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
