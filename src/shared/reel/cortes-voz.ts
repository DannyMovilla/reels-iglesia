import type { ClipSpec, Intensidad } from "../tipos";
import type { Palabra } from "./tiempo";

/**
 * pausaMaxima: una pausa más larga se acorta. margen: lo que queda de cada lado del corte
 * (la pausa resultante es el doble: 0,36 / 0,25 / 0,16 s).
 */
export const PARAMETROS_INTENSIDAD: Record<Intensidad, { pausaMaxima: number; margen: number }> = {
  suave: { pausaMaxima: 1.0, margen: 0.18 },
  normal: { pausaMaxima: 0.7, margen: 0.125 },
  fuerte: { pausaMaxima: 0.45, margen: 0.08 },
};
/** Pausa máxima de la intensidad Normal (la de los planes anteriores). */
export const PAUSA_MAXIMA = PARAMETROS_INTENSIDAD.normal.pausaMaxima;
export const MULETILLAS_POR_DEFECTO = ["eh", "ehh", "em", "emm", "mm", "mmm"];
/** Un tramo de menos de esto no se conserva (sonaría como un golpe). */
const MINIMO = 0.05;
const limpia = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]/g, "");

/** Una muletilla "suelta": no va pegada a la palabra siguiente y tiene aire antes o después. */
function esMuletillaSuelta(ws: Palabra[], i: number, MULETILLAS: Set<string>): boolean {
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
  const tramos = tramosPausas(c, palabras);
  const quitados = (c.cortes?.quitados ?? [])
    .map((q) => ({ inicio: Math.max(c.inicio, Math.min(q.inicio, q.fin)), fin: Math.min(c.fin, Math.max(q.inicio, q.fin)) }))
    .filter((q) => q.fin > q.inicio);
  if (!quitados.length) return tramos;
  let resto = tramos;
  for (const q of quitados) {
    resto = resto.flatMap((t) => {
      if (q.fin <= t.inicio || q.inicio >= t.fin) return [t];
      return [{ inicio: t.inicio, fin: r3(q.inicio) }, { inicio: r3(q.fin), fin: t.fin }].filter((x) => x.fin - x.inicio >= MINIMO);
    });
  }
  return resto.length ? resto : [{ inicio: c.inicio, fin: c.fin }];
}

/**
 * Frases repetidas (el predicador se traba y vuelve a empezar): cuando las mismas 3 palabras se repiten
 * dentro de 8 s, se sugiere quitar la primera toma (de 3 a 12 palabras) y dejar la última.
 * inicio = primera palabra de la primera toma; fin = inicio de la toma que se queda.
 */
export function detectarRepeticiones(palabras: Palabra[], inicio: number, fin: number): { inicio: number; fin: number; texto: string }[] {
  const ws = palabras.filter((w) => w.s >= inicio && w.e <= fin && limpia(w.t));
  const n = ws.map((w) => limpia(w.t));
  const r: { inicio: number; fin: number; texto: string }[] = [];
  for (let i = 0; i + 5 < ws.length; i++) {
    for (let j = i + 3; j <= i + 12 && j + 2 < ws.length && ws[j].s - ws[i].s <= 8; j++) {
      if (n[i] === n[j] && n[i + 1] === n[j + 1] && n[i + 2] === n[j + 2]) {
        r.push({ inicio: ws[i].s, fin: ws[j].s, texto: ws.slice(i, j).map((w) => w.t).join(" ") });
        i = j - 1;
        break;
      }
    }
  }
  return r;
}

/** Tramos con los cortes de pausas y muletillas (sin los tramos quitados a mano). */
function tramosPausas(c: ClipSpec, palabras: Palabra[]): { inicio: number; fin: number }[] {
  const { pausas, muletillas } = c.cortes ?? { pausas: false, muletillas: false };
  if (!pausas && !muletillas) return [{ inicio: c.inicio, fin: c.fin }];
  const { pausaMaxima: PAUSA_MAXIMA, margen: MARGEN } = PARAMETROS_INTENSIDAD[c.cortes.intensidad ?? "normal"];
  const MULETILLAS = new Set((c.cortes.lista ?? MULETILLAS_POR_DEFECTO).map(limpia).filter(Boolean));
  const ws = palabras.filter((w) => w.s >= c.inicio && w.e <= c.fin && w.t.trim());
  const tramos: { inicio: number; fin: number }[] = [];
  // Inicio: sin el silencio largo ni las muletillas antes de la primera palabra que se conserva.
  const primera = ws.findIndex((_, i) => !(muletillas && esMuletillaSuelta(ws, i, MULETILLAS)));
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
    if (muletillas && esMuletillaSuelta(ws, i, MULETILLAS)) {
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
