import type { Palabra } from "./tiempo";

export const DURACION_MINIMA = 5;

/** Ajusta el corte a límites de palabra (nunca media palabra); un clip de menos de 5 s se alarga hasta alcanzarlos. */
export function ajustarCorte(c: { inicio: number; fin: number }, palabras: Palabra[]): { inicio: number; fin: number } {
  if (palabras.length === 0) return c;
  const cercana = (t: number, k: "s" | "e") => palabras.reduce((m, w) => (Math.abs(w[k] - t) < Math.abs(m[k] - t) ? w : m))[k];
  const inicio = cercana(c.inicio, "s");
  let fin = cercana(c.fin, "e");
  if (fin - inicio < DURACION_MINIMA) {
    const suficiente = palabras.find((w) => w.e - inicio >= DURACION_MINIMA);
    fin = suficiente ? suficiente.e : palabras[palabras.length - 1].e;
  }
  return { inicio, fin };
}
