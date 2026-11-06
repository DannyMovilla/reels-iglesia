import { ESTILO_POR_DEFECTO } from "../../src/shared/clip";
import type { ClipSpec, Marca } from "../../src/shared/tipos";

/** Campos del plan 3 para los clips de prueba anteriores: sin cortes ni rótulo, para no cambiar sus tiempos. */
export const PLAN3: Pick<ClipSpec, "musica" | "cortes" | "efectos" | "redes"> = {
  musica: { modo: "auto", pista: null, animo: "esperanza", tonalidad: "Re", volumen: 0.12 },
  cortes: { pausas: false, muletillas: false },
  efectos: { transicion: "destello", grano: false, rotulo: false },
  redes: { instagram: { texto: "", hashtags: [] }, tiktok: { texto: "", hashtags: [] }, facebook: { texto: "" }, youtube: { titulo: "", texto: "" } },
};
export const SIN_MUSICA: ClipSpec["musica"] = { ...PLAN3.musica, modo: "ninguna", volumen: 0 };
export const MARCA_PLAN3: Pick<Marca, "logoEscala" | "redes" | "estilo"> = { logoEscala: 1, redes: {}, estilo: ESTILO_POR_DEFECTO };
