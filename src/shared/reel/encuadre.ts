import type { Caras, Formato } from "../tipos";

export interface ClaveCamara { t: number; x: number; y: number }

/**
 * Cámara virtual que sigue la cara del predicador (tiempo del video original):
 * elige la cara más grande y cercana a la anterior, zona muerta 0,035 en x / 0,05 en y,
 * y corte seco cuando la cara salta más de 0,15 y se queda ahí (cambio de cámara).
 */
export function pistaCamara(caras: Caras, desde: number, hasta: number): { keys: ClaveCamara[]; caraY: number } | null {
  const muestras = caras.filter(([t]) => t >= desde - 1 && t <= hasta + 1);
  if (muestras.length === 0) return null;
  let previa: [number, number, number, number] | null = null;
  const crudo = muestras.map(([t, lista]) => {
    const fs = lista.filter((f) => f[3] >= 0.7);
    if (fs.length === 0) return { t, f: null as typeof previa };
    let mejor = fs[0], costo = Infinity;
    for (const f of fs) {
      const c = (previa ? Math.abs(f[0] - previa[0]) * 2 : 0) - f[2] * 4;
      if (c < costo) { costo = c; mejor = f; }
    }
    previa = mejor;
    return { t, f: mejor };
  });
  const conCara = crudo.filter((r) => r.f);
  if (conCara.length < crudo.length * 0.3) return null;
  let ultima = conCara[0].f!;
  const lleno = crudo.map((r) => (r.f ? (ultima = r.f) : ultima));
  const keys: ClaveCamara[] = [];
  let cam: { x: number; y: number } | null = null;
  lleno.forEach((f, i) => {
    const t = crudo[i].t;
    const [tx, ty] = f;
    if (!cam) { cam = { x: tx, y: ty }; keys.push({ t, ...cam }); return; }
    const sig = lleno[i + 1];
    if (Math.abs(tx - cam.x) > 0.15 && (!sig || Math.abs(sig[0] - tx) < 0.06)) {
      keys.push({ t: Math.round((t - 0.02) * 1000) / 1000, ...cam });
      cam = { x: tx, y: ty };
      keys.push({ t, ...cam });
      return;
    }
    if (Math.abs(tx - cam.x) > 0.035) cam.x += (tx - cam.x) * 0.5;
    if (Math.abs(ty - cam.y) > 0.05) cam.y += (ty - cam.y) * 0.4;
    keys.push({ t, x: cam.x, y: cam.y });
  });
  const ys = lleno.filter((_, i) => crudo[i].t >= desde && crudo[i].t <= hasta).map((f) => f[1]).sort((a, b) => a - b);
  return { keys, caraY: ys.length ? ys[ys.length >> 1] : 0.3 };
}

/** Centro vertical del gancho (fracción del alto): debajo de la cara si la cara está arriba (solo 9:16). */
export function posicionGancho(caraY: number, formato: Formato): number {
  return formato === "9:16" && caraY < 0.5 ? 0.53 : 0.12;
}
