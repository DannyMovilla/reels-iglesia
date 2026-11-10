import type { EstiloSub } from "../tipos";

/** Estilos de subtítulo que arma el motor (los 7 de antes tienen su propio código). */
export type EstiloNuevo = Exclude<EstiloSub, "pop" | "caja" | "limpio" | "resaltado" | "karaoke" | "impacto" | "neon">;

/**
 * Un estilo hecho de piezas. `activa`: cómo se marca la palabra que se está diciendo
 * ("brillo" y "ninguna" solo destacan las palabras clave). `escala`: tamaño respecto de Pop. Sin fuente: usa la del clip.
 */
export interface PresetSub {
  mayusculas: boolean;
  contorno: "borde" | "sombra";
  activa: "color" | "escala" | "caja" | "subrayado" | "rebote" | "brillo" | "ninguna";
  colorActiva: "marca" | "amarillo";
  palabras: 1 | 2 | 3;
  letras: number;
  peso: 800 | 900;
  escala: number;
}

export const AMARILLO = "#FFE14D";

export const PRESETS_SUB: Record<EstiloNuevo, PresetSub> = {
  viral: { mayusculas: true, contorno: "borde", activa: "escala", colorActiva: "amarillo", palabras: 3, letras: 18, peso: 900, escala: 1 },
  una: { mayusculas: true, contorno: "borde", activa: "rebote", colorActiva: "marca", palabras: 1, letras: 14, peso: 900, escala: 1.6 },
  cajamarca: { mayusculas: true, contorno: "borde", activa: "caja", colorActiva: "marca", palabras: 3, letras: 16, peso: 900, escala: 1 },
  subrayado: { mayusculas: true, contorno: "sombra", activa: "subrayado", colorActiva: "marca", palabras: 3, letras: 18, peso: 800, escala: 1 },
  dostonos: { mayusculas: true, contorno: "borde", activa: "ninguna", colorActiva: "marca", palabras: 3, letras: 18, peso: 900, escala: 1 },
  rebote: { mayusculas: true, contorno: "borde", activa: "rebote", colorActiva: "marca", palabras: 2, letras: 14, peso: 900, escala: 1.1 },
  brillo: { mayusculas: true, contorno: "sombra", activa: "brillo", colorActiva: "marca", palabras: 3, letras: 18, peso: 800, escala: 1 },
  elegante: { mayusculas: false, contorno: "sombra", activa: "color", colorActiva: "marca", palabras: 3, letras: 24, peso: 800, escala: 0.9 },
};

export const esPreset = (e: EstiloSub): e is EstiloNuevo => Object.hasOwn(PRESETS_SUB, e);
