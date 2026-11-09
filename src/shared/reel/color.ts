/** Looks de color propios de Reels Iglesia (matrices de feColorMatrix, 4×5, fila por canal R, G, B, A). */
export type Look = "natural" | "calido" | "frio" | "cine" | "suave" | "bn";

export const IDENTIDAD = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

export const MATRIZ_LOOK: Record<Look, number[]> = {
  natural: IDENTIDAD,
  // Más rojo y menos azul: piel cálida, luz de atardecer.
  calido: [1.08, 0, 0, 0, 0.02, 0, 1.02, 0, 0, 0.01, 0, 0, 0.9, 0, 0, 0, 0, 0, 1, 0],
  // Menos rojo, más azul: limpio y fresco.
  frio: [0.92, 0, 0, 0, 0, 0, 1, 0, 0, 0.01, 0, 0, 1.1, 0, 0.02, 0, 0, 0, 1, 0],
  // Un poco más de contraste, pieles cálidas y sombras azuladas.
  cine: [1.1, -0.05, 0, 0, -0.02, -0.03, 1.05, 0, 0, -0.01, 0, -0.05, 1, 0, 0.03, 0, 0, 0, 1, 0],
  // Menos contraste y negros levantados: suave, luminoso.
  suave: [0.88, 0, 0, 0, 0.06, 0, 0.88, 0, 0, 0.06, 0, 0, 0.88, 0, 0.06, 0, 0, 0, 1, 0],
  // Blanco y negro con un tono apenas cálido.
  bn: [0.3, 0.59, 0.11, 0, 0.02, 0.3, 0.59, 0.11, 0, 0.01, 0.28, 0.55, 0.1, 0, 0, 0, 0, 0, 1, 0],
};

export const NOMBRE_LOOK: Record<Look, string> = { natural: "Natural", calido: "Cálido", frio: "Frío", cine: "Cine", suave: "Suave", bn: "B/N suave" };

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** La matriz del look a esa intensidad (0–1, mezcla con la identidad) y con el balance de blancos (ganancias R, G, B). */
export function matrizColor(look: Look, intensidad: number, balance?: [number, number, number]): number[] {
  const k = Math.max(0, Math.min(1, intensidad));
  const base = MATRIZ_LOOK[look] ?? IDENTIDAD;
  const m = IDENTIDAD.map((v, i) => v + (base[i] - v) * k);
  if (balance) for (let fila = 0; fila < 3; fila++) for (let j = 0; j < 5; j++) m[fila * 5 + j] *= balance[fila];
  return m.map((v) => r4(v) + 0);
}

/** ¿Este color cambia algo? (Natural sin balance, o sin color: el video queda como está.) */
export const colorActivo = (c?: { look: Look; intensidad: number; balance?: [number, number, number] }): boolean =>
  !!c && ((c.look !== "natural" && c.intensidad > 0) || !!c.balance);

/** El filtro SVG que usan los videos con `filter: url(#color)`. */
export const htmlFiltroColor = (m: number[]): string =>
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="color" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${m.join(" ")}"/></filter></svg>`;

/** Ganancias para que el color promedio del video quede gris (balance de blancos), limitadas a 0,7–1,4. */
export function balanceDesde(promedios: [number, number, number][]): [number, number, number] {
  if (!promedios.length) return [1, 1, 1];
  const m = [0, 1, 2].map((c) => promedios.reduce((a, p) => a + p[c], 0) / promedios.length);
  const gris = (m[0] + m[1] + m[2]) / 3;
  return m.map((v) => Math.round(Math.max(0.7, Math.min(1.4, v > 0 ? gris / v : 1)) * 1000) / 1000) as [number, number, number];
}
