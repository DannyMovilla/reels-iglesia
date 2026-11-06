import { recortar } from "./clip";
import type { Redes } from "./tipos";

/** Límites de cada red (caracteres; hashtags en Instagram). */
export const LIMITES_REDES = {
  instagram: { texto: 2200, hashtags: 30 },
  tiktok: { texto: 2200 },
  facebook: { texto: 5000 },
  youtube: { titulo: 100, texto: 5000 },
} as const;

export const NOMBRE_RED: Record<keyof Redes, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube Shorts" };

/** Deja cada texto dentro del límite de su red (cortando en una palabra completa). */
export function recortarRedes(r: Redes): Redes {
  const L = LIMITES_REDES;
  return {
    instagram: { texto: recortar(r.instagram.texto, L.instagram.texto), hashtags: r.instagram.hashtags.slice(0, L.instagram.hashtags) },
    tiktok: { texto: recortar(r.tiktok.texto, L.tiktok.texto), hashtags: [...r.tiktok.hashtags] },
    facebook: { texto: recortar(r.facebook.texto, L.facebook.texto) },
    youtube: { titulo: recortar(r.youtube.titulo, L.youtube.titulo), texto: recortar(r.youtube.texto, L.youtube.texto) },
  };
}

/** Texto listo para pegar en una red: texto + hashtags separados por una línea en blanco. */
export function textoParaPublicar(r: Redes, red: keyof Redes): string {
  const v = r[red] as { texto: string; hashtags?: string[]; titulo?: string };
  const partes = [red === "youtube" ? `${v.titulo}\n\n${v.texto}` : v.texto, (v.hashtags ?? []).join(" ")].filter((x) => x.trim());
  return partes.join("\n\n");
}
