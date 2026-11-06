import type { Animo, Categoria, ClipSpec, EstiloIglesia, Redes } from "./tipos";

export const ESTILO_POR_DEFECTO: EstiloIglesia = {
  subtitulos: { estilo: "pop", tamano: "m" },
  musica: { modo: "auto", volumen: 0.12 },
  cortes: { pausas: true, muletillas: true },
  efectos: { transicion: "destello", grano: false, rotulo: true },
  cierre: true,
  formatos: ["9:16", "4:5"],
};

const ANIMO_DE: Record<Categoria, Animo> = {
  Enseñanza: "reflexivo", Reflexión: "reflexivo", Exhortación: "victoria", Esperanza: "esperanza", Testimonio: "adoracion", Llamado: "victoria",
};

/** Corta en la última palabra completa que quepa en `max` caracteres. */
export function recortar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max + 1).lastIndexOf(" ");
  return texto.slice(0, corte > 0 ? corte : max).trimEnd();
}

/**
 * Clip guardado por cualquier versión de la app → ClipSpec completo.
 * Lo que falta se toma del estilo de la iglesia o de los campos viejos (descripción, hashtags, título).
 */
export function completarClip(entrada: unknown, estilo: EstiloIglesia): ClipSpec {
  const c = entrada as ClipSpec & { musica: Partial<ClipSpec["musica"]> & { pista?: string | null } };
  const m = c.musica ?? {};
  const pistaVieja = m.pista === "auto" || m.pista === undefined ? null : m.pista;
  const redes: Redes = c.redes ?? {
    instagram: { texto: c.descripcion ?? "", hashtags: [...(c.hashtags ?? [])] },
    tiktok: { texto: c.descripcion ?? "", hashtags: [...(c.hashtags ?? [])] },
    facebook: { texto: c.descripcion ?? "" },
    youtube: { titulo: recortar(c.titulo ?? "", 100), texto: c.descripcion ?? "" },
  };
  return {
    ...c,
    musica: {
      modo: m.modo ?? (m.pista === null ? "ninguna" : pistaVieja ? "pista" : estilo.musica.modo),
      pista: m.modo ? (m.pista ?? null) : pistaVieja,
      animo: m.animo ?? ANIMO_DE[c.categoria] ?? "reflexivo",
      tonalidad: m.tonalidad ?? "Re",
      volumen: m.volumen ?? estilo.musica.volumen,
    },
    cortes: c.cortes ?? { ...estilo.cortes },
    efectos: c.efectos ?? { ...estilo.efectos },
    redes,
  };
}

/** El estilo de la iglesia que corresponde a un clip ("Guardar como estilo de la iglesia"). */
export function estiloDesdeClip(c: ClipSpec): EstiloIglesia {
  return structuredClone({
    subtitulos: { estilo: c.subtitulos.estilo, tamano: c.subtitulos.tamano },
    musica: { modo: c.musica.modo, volumen: c.musica.volumen },
    cortes: c.cortes,
    efectos: c.efectos,
    cierre: c.cierre,
    formatos: c.formatos,
  });
}

/** Aplica el estilo de la iglesia a un clip (sin tocar su contenido: corte, textos, versículos, encuadre). */
export function aplicarEstiloAClip(c: ClipSpec, e: EstiloIglesia): ClipSpec {
  return structuredClone({
    ...c,
    subtitulos: { ...c.subtitulos, estilo: e.subtitulos.estilo, tamano: e.subtitulos.tamano },
    musica: { ...c.musica, modo: e.musica.modo, volumen: e.musica.volumen },
    cortes: e.cortes,
    efectos: e.efectos,
    cierre: e.cierre,
    formatos: e.formatos,
  });
}
