/**
 * Un paso de animación GSAP como datos. Sirve para la composición HyperFrames (se escribe como JS con `aJs`)
 * y para la galería del editor, que lo ejecuta con GSAP directamente (la app no permite `eval`).
 */
export type ValorAnim = number | string | boolean;
export interface PasoAnim {
  metodo: "set" | "to" | "from" | "fromTo";
  /** Selector CSS sin comillas: `#b0w1` o `#b0w1 .fondo`. */
  sel: string;
  /** Solo en fromTo: el estado inicial. */
  de?: Record<string, ValorAnim>;
  a: Record<string, ValorAnim>;
  t: number;
}

const valor = (v: ValorAnim) => (typeof v === "string" ? JSON.stringify(v) : String(v));
const objeto = (o: Record<string, ValorAnim>) => `{ ${Object.entries(o).map(([k, v]) => `${k}: ${valor(v)}`).join(", ")} }`;

/** `tl.<metodo>("<sel>", { … }[, { … }], <t>);` con el mismo formato que las animaciones escritas a mano. */
export function aJs(p: PasoAnim): string {
  const vars = p.de ? `${objeto(p.de)}, ${objeto(p.a)}` : objeto(p.a);
  return `tl.${p.metodo}(${JSON.stringify(p.sel)}, ${vars}, ${p.t});`;
}
