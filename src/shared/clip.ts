import type { Animo, Categoria, ClipSpec, EstiloIglesia, Redes } from "./tipos";
import { ajustarCorte } from "./reel/cortes";
import type { Palabra } from "./reel/tiempo";

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
    cortes: (({ quitados: _q, ...resto }) => resto)(c.cortes),
    efectos: c.efectos,
    cierre: c.cierre,
    formatos: c.formatos,
    ...(c.voz ? { voz: c.voz } : {}),
    ...(c.color ? { color: { look: c.color.look, intensidad: c.color.intensidad } } : {}),
    ...(c.fuentes ? { fuentes: c.fuentes } : {}),
    ...(c.estiloGancho ? { gancho: c.estiloGancho } : {}),
  });
}

/** Aplica el estilo de la iglesia a un clip (sin tocar su contenido: corte, textos, versículos, encuadre). */
export function aplicarEstiloAClip(c: ClipSpec, e: EstiloIglesia): ClipSpec {
  return structuredClone({
    ...c,
    subtitulos: { ...c.subtitulos, estilo: e.subtitulos.estilo, tamano: e.subtitulos.tamano },
    musica: { ...c.musica, modo: e.musica.modo, volumen: e.musica.volumen },
    // Los tramos quitados son del contenido del clip: se conservan.
    cortes: { ...e.cortes, ...(c.cortes?.quitados ? { quitados: c.cortes.quitados } : {}) },
    efectos: e.efectos,
    cierre: e.cierre,
    formatos: e.formatos,
    ...(e.voz ? { voz: e.voz } : {}),
    // El look viene del estilo; el balance es del video de este clip.
    ...(e.color ? { color: { ...e.color, ...(c.color?.balance ? { balance: c.color.balance } : {}) } } : {}),
    ...(e.fuentes ? { fuentes: e.fuentes } : {}),
    ...(e.gancho ? { estiloGancho: e.gancho } : {}),
  });
}

/**
 * Al cambiar el corte de [ini0, fin0] a [ini1, fin1], cada versículo sigue en el mismo momento del video.
 * Si ese momento quedó fuera del clip, el versículo se apaga y se marca "fuera" (el inspector lo avisa).
 */
export function moverVersiculos(vs: ClipSpec["versiculos"], ini0: number, _fin0: number, ini1: number, fin1: number): ClipSpec["versiculos"] {
  return vs.map((v) => {
    const momento = ini0 + v.en;
    const en = Math.round((momento - ini1) * 100) / 100;
    if (momento < ini1 || momento > fin1) return { ...v, en: Math.max(0, Math.min(en, fin1 - ini1)), activo: false, fuera: true };
    return { ...v, en, fuera: false };
  });
}

const nuevoId = (): string => globalThis.crypto?.randomUUID?.() ?? `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Clip creado a mano desde la transcripción: ajustado a palabras, de al menos 5 s, con el estilo de la iglesia. */
export function clipManual(inicio: number, fin: number, palabras: Palabra[], estilo: EstiloIglesia): ClipSpec {
  const corte = ajustarCorte({ inicio, fin }, palabras);
  const titulo = palabras.filter((w) => w.s >= corte.inicio && w.e <= corte.fin && w.t.trim()).slice(0, 6)
    .map((w) => w.t.trim()).join(" ").replace(/[.,;:]+$/, "") || "Clip a mano";
  return completarClip({
    id: nuevoId(), titulo, gancho: "", ganchosAlternativos: [], categoria: "Enseñanza", inicio: corte.inicio, fin: corte.fin,
    apertura: null, palabrasClave: [], versiculos: [], puntaje: 0, razon: "Clip creado a mano.", descripcion: "", hashtags: [],
    encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
    subtitulos: { activos: true, estilo: estilo.subtitulos.estilo, tamano: estilo.subtitulos.tamano, altura: 0.74 },
    musica: { modo: estilo.musica.modo, pista: null, volumen: estilo.musica.volumen },
    cortes: structuredClone(estilo.cortes), efectos: structuredClone(estilo.efectos), cierre: estilo.cierre, formatos: [...estilo.formatos],
    estado: "editado", origen: "manual", ...delEstiloParaClipNuevo(estilo),
  }, estilo);
}

/**
 * Lo que un clip NUEVO toma del estilo de la iglesia además de lo de siempre: voz, color, fuentes y gancho.
 * Un clip ya guardado no los toma al leerse (guardar un estilo no cambia clips viejos sin avisar).
 */
export function delEstiloParaClipNuevo(estilo: EstiloIglesia): Pick<ClipSpec, "voz" | "color" | "fuentes" | "estiloGancho"> {
  return {
    ...(estilo.gancho ? { estiloGancho: estilo.gancho } : {}),
    ...(estilo.voz ? { voz: estilo.voz } : {}),
    ...(estilo.color ? { color: { look: estilo.color.look, intensidad: estilo.color.intensidad } } : {}),
    ...(estilo.fuentes ? { fuentes: { ...estilo.fuentes } } : {}),
  };
}

/** Al volver a analizar: se quedan los favoritos, los clips a mano, los editados y los exportados; las sugerencias sin tocar se reemplazan. */
export function conservarAlReanalizar(viejos: ClipSpec[], nuevos: ClipSpec[]): ClipSpec[] {
  return [...viejos.filter((c) => c.favorito || c.origen === "manual" || c.estado !== "sugerido"), ...nuevos];
}
