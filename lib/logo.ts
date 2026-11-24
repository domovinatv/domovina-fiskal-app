"use client";

// Logo za PDF račun: backend (pdf-lib) ugrađuje samo PNG/JPEG, pa se SVG
// rasterizira ovdje, u pregledniku, prije slanja. Logo je na računu širok
// najviše ~6 cm, pa 1200 px daje ~500 dpi — kod ispisa jednako oštro kao vektor.
// Ista logika je i u adminu (backend src/admin/views.ts, izgledSekcija).

export const LOGO_MAX_BAJTOVA = 200 * 1024;
const MAX_SIRINA = 1200;
const MAX_VISINA = 400;

// Intrinzične dimenzije SVG-a (width/height, inače viewBox). Bez njih neki
// preglednici (Firefox) daju Image dimenzije 0, pa ih upisujemo eksplicitno.
function pripremiSvg(tekst: string): { svg: string; w: number; h: number } {
  const doc = new DOMParser().parseFromString(tekst, "image/svg+xml");
  const korijen = doc.documentElement;
  if (korijen.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
    throw new Error("SVG se ne može pročitati.");
  }
  const broj = (v: string | null) => {
    const n = v ? parseFloat(v) : NaN;
    return v && !v.trim().endsWith("%") && Number.isFinite(n) && n > 0 ? n : null;
  };
  const [, , vbSir, vbVis] = (korijen.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  const vbW = vbSir && vbSir > 0 ? vbSir : null;
  const vbH = vbVis && vbVis > 0 ? vbVis : null;
  const aw = broj(korijen.getAttribute("width"));
  const ah = broj(korijen.getAttribute("height"));
  let w: number;
  let h: number;
  if (aw && ah) [w, h] = [aw, ah];
  else if (aw && vbW && vbH) [w, h] = [aw, (aw * vbH) / vbW];
  else if (ah && vbW && vbH) [w, h] = [(ah * vbW) / vbH, ah];
  else if (vbW && vbH) [w, h] = [vbW, vbH];
  else throw new Error("SVG nema dimenzije (width/height ni viewBox).");
  korijen.setAttribute("width", String(w));
  korijen.setAttribute("height", String(h));
  return { svg: new XMLSerializer().serializeToString(korijen), w, h };
}

function ucitajSliku(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, greska) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => greska(new Error("SVG se ne može nacrtati (vanjski resursi ili neispravan sadržaj?)."));
    img.src = url;
  });
}

/// SVG datoteka → PNG data URL (prozirna pozadina), najviše 200 KB.
export async function svgUPng(datoteka: File): Promise<string> {
  const { svg, w, h } = pripremiSvg(await datoteka.text());
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await ucitajSliku(url);
    let mjerilo = Math.min(MAX_SIRINA / w, MAX_VISINA / h);
    for (let pokusaj = 0; pokusaj < 5; pokusaj++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * mjerilo));
      canvas.height = Math.max(1, Math.round(h * mjerilo));
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL("image/png");
      if ((png.length - png.indexOf(",") - 1) * 0.75 <= LOGO_MAX_BAJTOVA) return png;
      mjerilo *= 0.7; // presložen SVG → manja rezolucija
    }
    throw new Error("Logo je i nakon smanjivanja veći od 200 KB.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
