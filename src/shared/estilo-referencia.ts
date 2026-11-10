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
    fuentes: { titulos: e.fuenteTitulos, subtitulos: e.fuenteSubtitulos },
    musica: { ...c.musica, animo: e.animo },
    cortes: { ...c.cortes, pausas: true, intensidad: e.intensidad },
    color: { look: e.look, intensidad: c.color?.intensidad ?? 0.7, ...(c.color?.balance ? { balance: c.color.balance } : {}) },
    estado: c.estado === "sugerido" ? "editado" : c.estado,
  });
}
