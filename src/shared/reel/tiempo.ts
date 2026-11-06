import type { ClipSpec, Transcripcion } from "../tipos";
import { tramosDelClip } from "./cortes-voz";

export interface Palabra { s: number; e: number; t: string }

/** Un pedazo continuo del video original dentro de una parte (el clip puede tener varios si se cortan pausas). */
export interface TramoReel { inicioVideo: number; finVideo: number; inicioReel: number; duracion: number }

export interface Parte {
  tipo: "apertura" | "clip" | "cierre";
  inicioVideo: number;
  finVideo: number;
  inicioReel: number;
  duracion: number;
  /** Solo "clip": los tramos que se conservan, contiguos en el reel. */
  tramos?: TramoReel[];
}

export const DURACION_CIERRE = 2.6;
export const r2 = (n: number) => Math.round(n * 100) / 100;

export const palabrasDe = (t: Transcripcion): Palabra[] => t.segmentos.flatMap((s) => s.w.map(([ws, we, wt]) => ({ s: ws, e: we, t: wt })));

/**
 * Apertura en B/N (si está activa) + clip + cierre (si está activo), con sus tiempos en el reel.
 * Con las palabras, el clip aplica los cortes de pausas y muletillas (varios tramos).
 */
export function partesDelReel(c: ClipSpec, palabras?: Palabra[]): Parte[] {
  const partes: Parte[] = [];
  let t = 0;
  const agregar = (tipo: Parte["tipo"], ini: number, fin: number, dur: number, tramos?: TramoReel[]) => {
    partes.push({ tipo, inicioVideo: ini, finVideo: fin, inicioReel: r2(t), duracion: r2(dur), ...(tramos ? { tramos } : {}) });
    t = r2(t + dur);
  };
  if (c.apertura?.activa) agregar("apertura", c.apertura.inicio, c.apertura.fin, c.apertura.fin - c.apertura.inicio);
  const crudos = palabras ? tramosDelClip(c, palabras) : [{ inicio: c.inicio, fin: c.fin }];
  let enReel = t;
  const tramos = crudos.map((x) => {
    const tr = { inicioVideo: x.inicio, finVideo: x.fin, inicioReel: r2(enReel), duracion: r2(x.fin - x.inicio) };
    enReel += x.fin - x.inicio;
    return tr;
  });
  agregar("clip", c.inicio, c.fin, enReel - t, tramos);
  if (c.cierre) agregar("cierre", 0, 0, DURACION_CIERRE);
  return partes;
}

export const duracionReel = (c: ClipSpec, palabras?: Palabra[]): number => r2(partesDelReel(c, palabras).reduce((a, p) => a + p.duracion, 0));

/** Segundo del video original → segundo del reel dentro de la parte; null si ese momento se cortó o no está en la parte. */
export function videoAReel(p: Parte, t: number): number | null {
  for (const tr of p.tramos ?? [{ inicioVideo: p.inicioVideo, finVideo: p.finVideo, inicioReel: p.inicioReel, duracion: p.duracion }]) {
    if (t >= tr.inicioVideo && t <= tr.finVideo) return tr.inicioReel + (t - tr.inicioVideo);
  }
  return null;
}

/** Segundo del reel → segundo del video original (el más cercano si cae entre tramos). */
export function reelAVideo(p: Parte, t: number): number {
  const tramos = p.tramos ?? [{ inicioVideo: p.inicioVideo, finVideo: p.finVideo, inicioReel: p.inicioReel, duracion: p.duracion }];
  for (const tr of tramos) if (t <= tr.inicioReel + tr.duracion) return tr.inicioVideo + Math.max(0, t - tr.inicioReel);
  const u = tramos.at(-1)!;
  return u.finVideo;
}

/** El primer momento conservado en o después de t (video original), dentro de la parte. */
export function siguienteConservado(p: Parte, t: number): number {
  for (const tr of p.tramos ?? []) {
    if (t <= tr.finVideo) return Math.max(t, tr.inicioVideo);
  }
  return t;
}
