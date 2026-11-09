import type { Categoria, ClipSpec } from "./tipos";

export interface FiltroClips {
  texto: string;
  categorias: Categoria[];
  /** corta: menos de 30 s; media: 30 a 60 s; larga: más de 60 s. */
  duracion: "todas" | "corta" | "media" | "larga";
  puntajeMinimo: number;
  conVersiculo: boolean;
  favoritos: boolean;
  /** true: mostrar también los ocultos. */
  ocultos: boolean;
  orden: "impacto" | "video" | "cortos" | "largos";
}

export const FILTRO_INICIAL: FiltroClips = {
  texto: "", categorias: [], duracion: "todas", puntajeMinimo: 0, conVersiculo: false, favoritos: false, ocultos: false, orden: "impacto",
};

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dur = (c: ClipSpec) => c.fin - c.inicio;

/** Busca, filtra y ordena los clips como en la lista del editor. `textoDe`: lo que se dice en el clip (para buscar). */
export function filtrarClips(clips: ClipSpec[], f: FiltroClips, textoDe?: (c: ClipSpec) => string): ClipSpec[] {
  const q = sinTildes(f.texto.trim());
  const r = clips.filter((c) => {
    if (!f.ocultos && c.oculto) return false;
    if (f.favoritos && !c.favorito) return false;
    if (f.conVersiculo && c.versiculos.length === 0) return false;
    if (f.categorias.length && !f.categorias.includes(c.categoria)) return false;
    if (c.puntaje < f.puntajeMinimo) return false;
    const d = dur(c);
    if (f.duracion === "corta" && d >= 30) return false;
    if (f.duracion === "media" && (d < 30 || d > 60)) return false;
    if (f.duracion === "larga" && d <= 60) return false;
    if (q && !sinTildes(`${c.titulo} ${c.gancho} ${textoDe?.(c) ?? ""}`).includes(q)) return false;
    return true;
  });
  const orden: Record<FiltroClips["orden"], (a: ClipSpec, b: ClipSpec) => number> = {
    impacto: (a, b) => b.puntaje - a.puntaje,
    video: (a, b) => a.inicio - b.inicio,
    cortos: (a, b) => dur(a) - dur(b),
    largos: (a, b) => dur(b) - dur(a),
  };
  return r.sort(orden[f.orden]);
}
