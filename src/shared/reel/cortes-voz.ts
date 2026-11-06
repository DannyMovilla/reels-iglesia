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
  let inicio = c.inicio;
  let previa: Palabra | null = null;
  let quitada = false;
  ws.forEach((w, i) => {
    if (muletillas && esMuletillaSuelta(ws, i)) {
      quitada = true;
      return;
    }
    if (previa) {
      const hueco = w.s - previa.e;
      if (quitada || (pausas && hueco > PAUSA_MAXIMA)) {
        const fin = previa.e + Math.min(MARGEN, hueco / 2);
        if (fin - inicio > 0.05) tramos.push({ inicio, fin: r3(fin) });
        inicio = r3(w.s - Math.min(MARGEN, hueco / 2));
      }
    }
    previa = w;
    quitada = false;
  });
  if (c.fin - inicio > 0.05) tramos.push({ inicio, fin: c.fin });
  return tramos.length ? tramos : [{ inicio: c.inicio, fin: c.fin }];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
