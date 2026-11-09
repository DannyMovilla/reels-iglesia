import type { Transcripcion } from "./tipos";

/** Una palabra corregida. `en`: segundo de inicio de la palabra (solo esa); sin `en`, todas las apariciones. */
export interface Correccion {
  de: string;
  a: string;
  en?: number;
}

/** La palabra sin tildes, mayúsculas ni signos: "¡Dios," → "dios" (para buscar). */
export const nucleo = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, "");
/** La palabra sin mayúsculas ni signos, pero con sus tildes y su ñ: "él" y "el" son palabras distintas (para corregir). */
const clave = (t: string): string => t.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
/** Signos al principio y al final de la palabra: "¡Dios," → ["¡", ","]. */
const bordes = (t: string): [string, string] => [/^[^\p{L}\p{N}]*/u.exec(t)![0], /[^\p{L}\p{N}]*$/u.exec(t)![0]];
const sinBordes = (t: string): string => t.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/**
 * Aplica las correcciones de la persona a la transcripción (sin tocar la original). Cada palabra que coincide
 * conserva sus propios signos ("dios," → "Dios," también cambia "Dios." a "Dios.") y no se tocan palabras
 * parecidas ("diosa"). El texto de cada segmento cambiado se rearma con sus palabras.
 */
export function aplicarCorrecciones(t: Transcripcion, cs: Correccion[]): Transcripcion {
  if (!cs.length) return t;
  // Si la persona cambió los signos en la corrección ("dios," → "Dios."), se usan los suyos; si no, cada palabra conserva los propios.
  const reglas = cs.map((c) => {
    const [deAntes, deDespues] = bordes(c.de.trim()), [aAntes, aDespues] = bordes(c.a.trim());
    const signos: [string, string] = [aAntes !== deAntes ? aAntes : "", aDespues !== deDespues ? aDespues : ""];
    return { ...c, n: clave(c.de), nuevo: sinBordes(c.a), signos };
  }).filter((c) => c.n && c.nuevo);
  return {
    ...t,
    segmentos: t.segmentos.map((s) => {
      let cambio = false;
      const w = s.w.map(([ws, we, texto]): [number, number, string] => {
        let actual = texto;
        for (const r of reglas) {
          if (clave(actual) !== r.n) continue;
          if (r.en !== undefined && Math.abs(ws - r.en) > 0.01) continue;
          const [antes, despues] = bordes(actual);
          actual = `${r.signos[0] || antes}${r.nuevo}${r.signos[1] || despues}`;
        }
        if (actual !== texto) cambio = true;
        return [ws, we, actual];
      });
      return cambio ? { ...s, w, t: w.map((x) => x[2].trim()).join(" ") } : s;
    }),
  };
}
