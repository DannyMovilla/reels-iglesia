import type { Formato } from "../tipos";

const ALTOS: Record<Formato, number> = { "9:16": 1920, "4:5": 1350, "1:1": 1080 };

export type Red = "tiktok" | "instagram" | "youtube" | "facebook";
export interface Zona { arriba: number; abajo: number; izquierda: number; derecha: number }

/** Lo que tapa cada red (botones, nombre, descripción), en píxeles de un reel de 1080 de ancho. */
const VERTICAL: Record<Red, Zona> = {
  tiktok: { arriba: 150, abajo: 380, izquierda: 60, derecha: 150 },
  instagram: { arriba: 200, abajo: 340, izquierda: 60, derecha: 120 },
  youtube: { arriba: 120, abajo: 320, izquierda: 60, derecha: 110 },
  facebook: { arriba: 180, abajo: 360, izquierda: 60, derecha: 120 },
};
const BORDE: Zona = { arriba: 60, abajo: 60, izquierda: 60, derecha: 60 };

export const ZONAS: Record<Red, Record<Formato, Zona>> = Object.fromEntries(
  (Object.keys(VERTICAL) as Red[]).map((r) => [r, { "9:16": VERTICAL[r], "4:5": BORDE, "1:1": BORDE }]),
) as Record<Red, Record<Formato, Zona>>;

export const NOMBRE_RED_ZONA: Record<Red, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", facebook: "Facebook" };

/** La zona que ninguna red tapa: el lado más grande de cada una. */
export function zonaComun(formato: Formato): Zona {
  const zs = (Object.keys(ZONAS) as Red[]).map((r) => ZONAS[r][formato]);
  return {
    arriba: Math.max(...zs.map((z) => z.arriba)), abajo: Math.max(...zs.map((z) => z.abajo)),
    izquierda: Math.max(...zs.map((z) => z.izquierda)), derecha: Math.max(...zs.map((z) => z.derecha)),
  };
}

/**
 * Un `top` que deja el elemento (de `alto` píxeles) dentro de la zona común. `ancla`: "centro" si el top es el
 * centro del elemento (translateY(-50%)), "arriba" si es su borde de arriba. Si ya cabe, no se mueve.
 */
export function dentroDeZona(top: number, alto: number, formato: Formato, ancla: "centro" | "arriba" = "centro"): number {
  const z = zonaComun(formato), H = ALTOS[formato];
  const arriba = ancla === "centro" ? top - alto / 2 : top;
  const min = z.arriba, max = H - z.abajo - alto;
  const nuevo = Math.min(Math.max(arriba, min), Math.max(min, max));
  return Math.round((ancla === "centro" ? nuevo + alto / 2 : nuevo) * 100) / 100;
}
