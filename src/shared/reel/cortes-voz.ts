import type { ClipSpec } from "../tipos";
import type { Palabra } from "./tiempo";

/** Una pausa más larga que esto se acorta. */
export const PAUSA_MAXIMA = 0.7;
/** Lo que queda de cada lado de un corte (la pausa resultante es el doble: 0,25 s). */
const MARGEN = 0.125;
const MULETILLAS = new Set(["eh", "ehh", "em", "emm", "mm", "mmm"]);
const limpia = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/** Una muletilla "suelta": no va pegada a la palabra siguiente y tiene aire antes o después. */
function esMuletillaSuelta(ws: Palabra[], i: number): boolean {
  if (!MULETILLAS.has(limpia(ws[i].t))) return false;
  const antes = i > 0 ? ws[i].s - ws[i - 1].e : Infinity;
  const despues = i < ws.length - 1 ? ws[i + 1].s - ws[i].e : Infinity;
  return despues >= 0.05 && (antes > 0.15 || despues > 0.15);
}

/**
 * Tramos del video original que se conservan en el clip (en orden): se acortan las pausas de más de
 * 0,7 s a 0,25 s y se quitan las muletillas sueltas ("eh", "em", "mmm"). Sin cortes: [inicio, fin].
 */
export function tramosDelClip(c: ClipSpec, palabras: Palabra[]): { inicio: number; fin: number }[] {
  const { pausas, muletillas } = c.cortes ?? { pausas: false, muletillas: false };
  if (!pausas && !muletillas) return [{ inicio: c.inicio, fin: c.fin }];
  const ws = palabras.filter((w) => w.s >= c.inicio && w.e <= c.fin && w.t.trim());
  const tramos: { inicio: number; fin: number }[] = [];
  // Inicio: sin el silencio largo ni las muletillas antes de la primera palabra que se conserva.
  const primera = ws.findIndex((_, i) => !(muletillas && esMuletillaSuelta(ws, i)));
  let inicio = c.inicio;
  if (primera >= 0) {
    const p = ws[primera];
    const antes = primera > 0 ? ws[primera - 1].e : c.inicio;
    if (primera > 0 || (pausas && p.s - c.inicio > PAUSA_MAXIMA)) inicio = r3(Math.max(c.inicio, p.s - Math.min(MARGEN, Math.max(0, (p.s - antes) / 2))));
  }
  let previa: Palabra | null = null;
  // Muletillas quitadas entre la palabra anterior y la actual (desde el inicio de la primera hasta el fin de la última).
  let quitadaIni = Infinity, quitadaFin = -Infinity;
  ws.forEach((w, i) => {
    if (muletillas && esMuletillaSuelta(ws, i)) {
      quitadaIni = Math.min(quitadaIni, w.s);
      quitadaFin = Math.max(quitadaFin, w.e);
      return;
    }
    if (previa) {
      const hueco = w.s - previa.e;
      const hubo = quitadaFin > -Infinity;
      if (hubo || (pausas && hueco > PAUSA_MAXIMA)) {
        // Con muletilla, el aire de cada lado se mide hasta la muletilla: nunca queda un pedazo del "eh".
        const fin = previa.e + Math.min(MARGEN, Math.max(0, ((hubo ? quitadaIni : w.s) - previa.e) / 2));
        if (fin - inicio > 0.05) tramos.push({ inicio, fin: r3(fin) });
        inicio = r3(w.s - Math.min(MARGEN, Math.max(0, (w.s - (hubo ? quitadaFin : previa.e)) / 2)));
      }
    }
    previa = w;
    quitadaIni = Infinity;
    quitadaFin = -Infinity;
  });
  // Final: sin las muletillas ni el silencio largo después de la última palabra que se conserva.
  let fin = c.fin;
  if (previa) {
    const u: Palabra = previa;
    const despues = quitadaFin > -Infinity ? quitadaIni : c.fin;
    if (quitadaFin > -Infinity || (pausas && c.fin - u.e > PAUSA_MAXIMA)) fin = r3(Math.min(c.fin, u.e + Math.min(MARGEN, Math.max(0, (despues - u.e) / 2))));
  }
  if (fin - inicio > 0.05) tramos.push({ inicio, fin });
  return tramos.length ? tramos : [{ inicio: c.inicio, fin: c.fin }];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
