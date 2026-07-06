// Sitni pomoćnici za prikaz — hrvatski formati i pilule statusa.

export function iznosHr(iznos: string | null | undefined): string {
  if (iznos == null) return "—";
  const n = Number(iznos);
  if (!Number.isFinite(n)) return iznos;
  return n.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TIP_NAZIVI: Record<string, string> = {
  ponuda: "Ponuda",
  predracun: "Predračun",
  racun: "Račun",
  fiskalni_b2c: "Fiskalni B2C",
};

export function tipNaziv(tip: string): string {
  return TIP_NAZIVI[tip] ?? tip;
}

export function statusPilula(status: string) {
  const boja =
    status === "izdano" || status === "fiskaliziran"
      ? "bg-[#E0F1E5] text-uspjeh"
      : status === "nacrt"
        ? "bg-[#E7EEF8] text-[#1D4ED8]"
        : "bg-[#ECEFF2] text-muted";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${boja}`}>
      {status}
    </span>
  );
}
