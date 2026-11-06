import type { ClipSpec, Transcripcion } from "../tipos";

export interface Palabra { s: number; e: number; t: string }

export interface Parte {
  tipo: "apertura" | "clip" | "cierre";
  inicioVideo: number;
  finVideo: number;
  inicioReel: number;
  duracion: number;
}

export const DURACION_CIERRE = 2.6;
export const r2 = (n: number) => Math.round(n * 100) / 100;

export const palabrasDe = (t: Transcripcion): Palabra[] => t.segmentos.flatMap((s) => s.w.map(([ws, we, wt]) => ({ s: ws, e: we, t: wt })));

/** Apertura en B/N (si está activa) + clip + cierre (si está activo), con sus tiempos en el reel. */
export function partesDelReel(c: ClipSpec): Parte[] {
  const partes: Parte[] = [];
  let t = 0;
  const agregar = (tipo: Parte["tipo"], ini: number, fin: number, dur: number) => {
    partes.push({ tipo, inicioVideo: ini, finVideo: fin, inicioReel: r2(t), duracion: r2(dur) });
    t = r2(t + dur);
  };
  if (c.apertura?.activa) agregar("apertura", c.apertura.inicio, c.apertura.fin, c.apertura.fin - c.apertura.inicio);
  agregar("clip", c.inicio, c.fin, c.fin - c.inicio);
  if (c.cierre) agregar("cierre", 0, 0, DURACION_CIERRE);
  return partes;
}

export const duracionReel = (c: ClipSpec): number => r2(partesDelReel(c).reduce((a, p) => a + p.duracion, 0));
