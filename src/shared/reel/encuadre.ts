import type { Caras, Formato } from "../tipos";

export interface ClaveCamara { t: number; x: number; y: number }

/**
 * Cámara virtual que sigue la cara del predicador (tiempo del video original):
 * elige la cara más grande y cercana a la anterior, zona muerta 0,035 en x / 0,05 en y,
 * y corte seco cuando la cara salta más de 0,15 y se queda ahí (cambio de cámara).
 */
export function pistaCamara(caras: Caras, desde: number, hasta: number): { keys: ClaveCamara[]; caraY: number; caraAncho: number } | null {
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
  const dentro = lleno.filter((_, i) => crudo[i].t >= desde && crudo[i].t <= hasta);
  const mediana = (v: number[], d: number) => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : d);
  return { keys, caraY: mediana(dentro.map((f) => f[1]), 0.3), caraAncho: mediana(dentro.map((f) => f[2]), 0.06) };
}

/** Cara en el cuadro de salida: centro y alto como fracción del alto del reel. */
export interface CaraEnCuadro { centro: number; alto: number }

/** Medio alto del cartel del gancho (2 líneas) como fracción del alto de cada formato. */
const MEDIO_GANCHO: Record<Formato, number> = { "9:16": 0.055, "4:5": 0.075, "1:1": 0.095 };

/**
 * Centro vertical del gancho (fracción del alto de salida): en la franja libre más grande,
 * arriba o debajo de la cabeza (pelo ≈ 0,9 alto de cara por encima del centro, mentón ≈ 0,7 por debajo),
 * sin bajar a la zona de los subtítulos.
 */
export function posicionGancho(cara: CaraEnCuadro, formato: Formato, medio: number = MEDIO_GANCHO[formato]): number {
  const m = medio;
  const cabezaArriba = cara.centro - cara.alto * 0.9 - 0.03;
  const cabezaAbajo = cara.centro + cara.alto * 0.7 + 0.03;
  const tam = (f: [number, number]) => f[1] - f[0];
  const elegir = (limArriba: number, limAbajo: number): [number, number] => {
    const arriba: [number, number] = [limArriba, cabezaArriba];
    const abajo: [number, number] = [cabezaAbajo, limAbajo];
    return tam(arriba) >= tam(abajo) ? arriba : abajo;
  };
  // Primero sin bajar a los subtítulos; si no cabe, puede llegar al borde del cuadro.
  let franja = elegir(0.04, formato === "9:16" ? 0.68 : 0.72);
  if (tam(franja) < 2 * m) franja = elegir(0.01, 0.99);
  const [a, b] = franja;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  if (tam(franja) < 2 * m) return r3((a + b) / 2);
  // Lo más cerca posible de la cabeza sin tocarla (se lee junto a quien habla).
  return r3(b === cabezaArriba ? b - m - 0.02 : a + m + 0.02);
}
