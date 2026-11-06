import type { Animo } from "../tipos";

export interface Pista {
  id: string;
  archivo: string;
  titulo: string;
  autor: string;
  licencia: string;
  animo: Animo;
  /** Segundos. */
  duracion: number;
  /** Agregada por la persona (todas, por ahora: la app no trae música). */
  propia: boolean;
}

/**
 * Pista para un reel: mismo ánimo, sin repetir las de los últimos 3 reels del proyecto,
 * que dure todo el reel (si ninguna alcanza, la más larga). `recientes`: ids, el primero es el más reciente.
 * null si no hay ninguna de ese ánimo (entonces se usa un pad).
 */
export function elegirPista(animo: Animo, pistas: Pista[], recientes: string[], duracionReel: number): Pista | null {
  const delAnimo = pistas.filter((x) => x.animo === animo);
  if (delAnimo.length === 0) return null;
  const ultimas = recientes.slice(0, 3);
  const libres = delAnimo.filter((x) => !ultimas.includes(x.id));
  if (libres.length === 0) {
    // Todas se usaron hace poco: la que se usó hace más tiempo.
    return [...delAnimo].sort((a, b) => ultimas.indexOf(b.id) - ultimas.indexOf(a.id))[0];
  }
  return libres.find((x) => x.duracion >= duracionReel) ?? [...libres].sort((a, b) => b.duracion - a.duracion)[0];
}
