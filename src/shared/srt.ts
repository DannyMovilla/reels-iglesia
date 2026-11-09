import type { Palabra } from "./reel/tiempo";

/** Un subtítulo del SRT. `texto` lleva "\n" entre sus líneas (máximo dos). */
export interface BloqueSrt { desde: number; hasta: number; texto: string }

export interface ReglasSrt { maxLinea: number; maxLineas: number; maxCps: number; minDur: number; maxDur: number }
/** Reglas de lectura habituales (Netflix/TV en español). */
export const REGLAS_SRT: ReglasSrt = { maxLinea: 42, maxLineas: 2, maxCps: 17, minDur: 1, maxDur: 7 };

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Reparte el texto en líneas de `max` caracteres (lo más parejas posible), o null si no cabe en `lineas`. */
export function partirLineas(texto: string, max: number, lineas: number): string[] | null {
  if (texto.length <= max) return [texto];
  if (lineas < 2) return null;
  const ws = texto.split(" ");
  let mejor: string[] | null = null;
  for (let i = 1; i < ws.length; i++) {
    const a = ws.slice(0, i).join(" "), b = ws.slice(i).join(" ");
    if (a.length > max || b.length > max) continue;
    if (!mejor || Math.abs(a.length - b.length) < Math.abs(mejor[0].length - mejor[1].length)) mejor = [a, b];
  }
  return mejor;
}

/**
 * Subtítulos de la prédica a partir de sus palabras: cada bloque cierra al final de una oración, en una pausa
 * de más de 1 s, cuando no cabe la siguiente palabra (2 líneas de 42) o cuando pasaría de 7 s. Cada bloque dura
 * al menos 1 s y lo necesario para leerlo (17 caracteres por segundo) sin pisar al siguiente.
 */
export function bloquesSrt(palabras: Palabra[], reglas: Partial<ReglasSrt> = {}): BloqueSrt[] {
  const R = { ...REGLAS_SRT, ...reglas };
  const ws = palabras.map((w) => ({ ...w, t: w.t.replace(/\s+/g, " ").trim() })).filter((w) => w.t);
  const grupos: (typeof ws)[] = [];
  let actual: typeof ws = [];
  const texto = (g: typeof ws) => g.map((w) => w.t).join(" ");
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (actual.length) {
      const cabe = partirLineas(texto([...actual, w]), R.maxLinea, R.maxLineas) !== null;
      const largo = w.e - actual[0].s > R.maxDur;
      // Leer lo que ya hay más esta palabra no debe pedir más tiempo del que dura.
      const lento = (texto([...actual, w]).length / R.maxCps) > Math.max(R.maxDur, (ws[i + 1]?.s ?? w.e + 1) - actual[0].s);
      if (!cabe || largo || lento) {
        grupos.push(actual);
        actual = [];
      }
    }
    actual.push(w);
    const sig = ws[i + 1];
    const dur = w.e - actual[0].s;
    const finOracion = /[.?!…]["»”)]?$/.test(w.t) && dur >= 1.2;
    const pausa = sig && sig.s - w.e > 1;
    const comaLlena = /[,;:]$/.test(w.t) && texto(actual).length > R.maxLinea * 1.2;
    if (finOracion || pausa || comaLlena) {
      grupos.push(actual);
      actual = [];
    }
  }
  if (actual.length) grupos.push(actual);

  const bloques: BloqueSrt[] = [];
  grupos.forEach((g, i) => {
    const t = texto(g);
    const desde = Math.max(g[0].s, bloques.at(-1)?.hasta ?? 0);
    const tope = Math.min(desde + R.maxDur, grupos[i + 1]?.[0].s ?? Infinity);
    const hasta = Math.min(tope, Math.max(g[g.length - 1].e, desde + R.minDur, desde + t.length / R.maxCps));
    bloques.push({ desde: r3(desde), hasta: r3(Math.max(hasta, desde + 0.001)), texto: (partirLineas(t, R.maxLinea, R.maxLineas) ?? [t]).join("\n") });
  });
  return bloques;
}

const marca = (s: number): string => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), seg = Math.floor((ms % 60000) / 1000), resto = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")},${String(resto).padStart(3, "0")}`;
};

/** Texto del archivo .srt (`desplazar`: segundos que se suman, p. ej. el inicio de la prédica en el video completo). */
export function textoSrt(bloques: BloqueSrt[], desplazar = 0): string {
  return bloques.map((b, i) => `${i + 1}\n${marca(b.desde + desplazar)} --> ${marca(b.hasta + desplazar)}\n${b.texto}\n`).join("\n");
}

const segundos = (m: string): number => {
  const [h, mi, rest] = m.trim().split(":");
  const [s, ms] = rest.split(/[,.]/);
  return Number(h) * 3600 + Number(mi) * 60 + Number(s) + Number(ms) / 1000;
};

/** Lee un .srt (con saltos de línea de Windows o no). */
export function leerSrt(texto: string): BloqueSrt[] {
  return texto.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).flatMap((b) => {
    const lineas = b.split("\n");
    const i = lineas.findIndex((l) => l.includes("-->"));
    if (i < 0) return [];
    const [a, z] = lineas[i].split("-->");
    return [{ desde: r3(segundos(a)), hasta: r3(segundos(z)), texto: lineas.slice(i + 1).join("\n") }];
  });
}
