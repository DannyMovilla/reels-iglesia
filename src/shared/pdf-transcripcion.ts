import type { Capitulos } from "./capitulos";
import type { Transcripcion } from "./tipos";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mmss = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return t >= 3600 ? `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Oraciones por párrafo del PDF. */
const ORACIONES = 6;

export interface DatosPdf {
  proyecto: { nombre: string; creado: string; predicador?: string };
  marca: { nombre: string; predicador?: string };
  transcripcion: Transcripcion;
  capitulos?: Capitulos | null;
}

/**
 * HTML imprimible (A4) de la transcripción, para estudios de célula: iglesia, título, fecha y predicador,
 * resumen y capítulos si existen, y el texto en párrafos con su minuto (desde el inicio de la prédica).
 */
export function htmlTranscripcion(d: DatosPdf): string {
  const t = d.transcripcion;
  const parrafos: { desde: number; texto: string }[] = [];
  let actual: { desde: number; texto: string } | null = null;
  let oraciones = 0;
  for (const s of t.segmentos) {
    const texto = s.t.trim();
    if (!texto) continue;
    if (!actual) actual = { desde: s.s - t.inicio, texto: "" };
    actual.texto += (actual.texto ? " " : "") + texto;
    oraciones += (texto.match(/[.?!…](\s|$)/g) ?? []).length || 0;
    if (oraciones >= ORACIONES) {
      parrafos.push(actual);
      actual = null;
      oraciones = 0;
    }
  }
  if (actual) parrafos.push(actual);
  const fecha = new Date(d.proyecto.creado).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const predicador = d.proyecto.predicador ?? d.marca.predicador;
  const meta = [fecha, predicador].filter(Boolean).map((x) => esc(x!)).join(" · ");
  const caps = d.capitulos?.capitulos.length
    ? `<section class="resumen"><h2>Resumen</h2><p>${esc(d.capitulos.resumen)}</p><h2>Capítulos</h2><ol class="capitulos">${d.capitulos.capitulos.map((c) => `<li>${mmss(c.t)} ${esc(c.titulo)}</li>`).join("")}</ol></section>`
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(d.proyecto.nombre)}</title><style>
@page { size: A4; margin: 22mm 20mm; }
body { font: 11.5pt/1.6 Georgia, "Times New Roman", serif; color: #1a1a1a; }
header { border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 18px; }
.iglesia { font: 600 10pt "Segoe UI", Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #555; }
h1 { font: 700 22pt "Segoe UI", Arial, sans-serif; margin: 4px 0; }
.meta { font: 10pt "Segoe UI", Arial, sans-serif; color: #555; }
h2 { font: 700 12pt "Segoe UI", Arial, sans-serif; margin: 14px 0 6px; }
.resumen { background: #f4f1ea; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; break-inside: avoid; }
.capitulos { margin: 0; padding-left: 0; list-style: none; font: 10pt "Segoe UI", Arial, sans-serif; }
p.parrafo { margin: 0 0 12px; text-align: justify; }
.minuto { font: 600 9pt "Segoe UI", Arial, sans-serif; color: #888; margin-right: 6px; }
</style></head><body>
<header><div class="iglesia">${esc(d.marca.nombre)}</div><h1>${esc(d.proyecto.nombre)}</h1><div class="meta">${meta}</div></header>
${caps}
<main>${parrafos.map((p) => `<p class="parrafo"><span class="minuto">${mmss(p.desde)}</span>${esc(p.texto)}</p>`).join("\n")}</main>
</body></html>`;
}
