import type { ClipSpec } from "../tipos";
import { type Parte, r2 } from "./tiempo";

export interface Ventana { desde: number; hasta: number }

/** Tiempo de lectura de la tarjeta: 0,5 s + 0,3 s por palabra, entre 4 y 8 s. */
export function duracionLectura(texto: string): number {
  const n = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  return Math.min(8, Math.max(4, Math.round((0.5 + 0.3 * n) * 10) / 10));
}

/** Ventana (en tiempo de reel) de la tarjeta del versículo, siempre dentro del clip. null si está apagado. */
export function ventanaVersiculo(v: ClipSpec["versiculos"][number], clip: Parte): Ventana | null {
  if (!v.activo) return null;
  const finClip = r2(clip.inicioReel + clip.duracion);
  const dur = Math.min(duracionLectura(v.texto), clip.duracion);
  let desde = r2(clip.inicioReel + Math.min(Math.max(0, v.en), clip.duracion));
  let hasta = r2(desde + dur);
  if (hasta > finClip) {
    hasta = finClip;
    desde = Math.max(clip.inicioReel, hasta - dur);
  }
  return { desde, hasta };
}
