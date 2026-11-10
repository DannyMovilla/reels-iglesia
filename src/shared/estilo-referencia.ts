import type { Look } from "./reel/color";
import type { IdFuente } from "./reel/fuentes";
import type { Animo, ClipSpec, EstiloSub, Intensidad } from "./tipos";

/** El estilo que Claude propone a partir de un reel de referencia. */
export interface EstiloReferencia {
  subtitulos: EstiloSub;
  tamano: "s" | "m" | "l";
  /** Altura de los subtítulos (0,55–0,85 del alto). */
  altura: number;
  fuenteTitulos: IdFuente;
  fuenteSubtitulos: IdFuente;
  animo: Animo;
  intensidad: Intensidad;
  look: Look;
  explicacion: string;
}

/** Aplica el estilo de referencia a un clip sin tocar su contenido (corte, textos, versículos, tramos quitados). */
export function aplicarReferencia(c: ClipSpec, e: EstiloReferencia): ClipSpec {
  return structuredClone({
    ...c,
    subtitulos: { ...c.subtitulos, estilo: e.subtitulos, tamano: e.tamano, altura: e.altura },
    // La fuente de la iglesia se conserva (la referencia solo propone Montserrat o Figtree).
    fuentes: { titulos: c.fuentes?.titulos === "iglesia" ? "iglesia" : e.fuenteTitulos, subtitulos: c.fuentes?.subtitulos === "iglesia" ? "iglesia" : e.fuenteSubtitulos },
    musica: { ...c.musica, animo: e.animo },
    cortes: { ...c.cortes, pausas: true, intensidad: e.intensidad },
    color: { look: e.look, intensidad: c.color?.intensidad ?? 0.7, ...(c.color?.balance ? { balance: c.color.balance } : {}) },
    estado: c.estado === "sugerido" ? "editado" : c.estado,
  });
}

/** Lo que aplicar el estilo cambia además de lo propuesto (para decirlo en la tarjeta). */
export function cambiosExtra(c: ClipSpec): string[] {
  const r: string[] = [];
  if (!c.cortes.pausas) r.push("También se activará «Acortar pausas largas».");
  if (c.fuentes?.titulos === "iglesia") r.push("Se mantiene la fuente de la iglesia en los títulos.");
  if (c.fuentes?.subtitulos === "iglesia") r.push("Se mantiene la fuente de la iglesia en los subtítulos.");
  return r;
}
