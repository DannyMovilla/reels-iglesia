import type { Formato } from "../tipos";
import type { PasoAnim } from "./pasos";

/** Cómo se ve el gancho en los primeros segundos del reel. "tarjeta" es el de siempre (antes del plan 8). */
export type EstiloGancho = "tarjeta" | "gigante" | "marca" | "subrayado" | "golpe";
export const NOMBRE_GANCHO: Record<EstiloGancho, string> = {
  tarjeta: "Tarjeta", gigante: "Gigante", marca: "Franja de marca", subrayado: "Subrayado", golpe: "Golpe",
};
export const ESTILOS_GANCHO = Object.keys(NOMBRE_GANCHO) as EstiloGancho[];

/** Medio alto del gancho como fracción del alto de cada formato (para ubicarlo junto a la cabeza). */
export const MEDIO_GANCHO_ESTILO: Record<EstiloGancho, Record<Formato, number>> = {
  tarjeta: { "9:16": 0.055, "4:5": 0.075, "1:1": 0.095 },
  gigante: { "9:16": 0.09, "4:5": 0.11, "1:1": 0.13 },
  marca: { "9:16": 0.07, "4:5": 0.09, "1:1": 0.11 },
  subrayado: { "9:16": 0.075, "4:5": 0.095, "1:1": 0.115 },
  golpe: { "9:16": 0.09, "4:5": 0.11, "1:1": 0.13 },
};
/** Alto aproximado (px) para mantenerlo dentro de la zona segura común. */
export const ALTO_GANCHO_PX: Record<EstiloGancho, number> = { tarjeta: 200, gigante: 400, marca: 260, subrayado: 300, golpe: 400 };

const TAMANO_GIGANTE: Record<Formato, number> = { "9:16": 120, "4:5": 104, "1:1": 92 };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, "");
const r2 = (x: number) => Math.round(x * 100) / 100;
const palabrasDe = (texto: string) => texto.trim().split(/\s+/).filter(Boolean);

function claro(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

/** La palabra del gancho que va en color: la primera que es palabra clave del clip; si no hay, la más larga. */
export function palabraEnColor(gancho: string, claves: string[]): number {
  const ps = palabrasDe(gancho).map(norm);
  const set = new Set(claves.map(norm).filter(Boolean));
  const clave = ps.findIndex((p) => p && set.has(p));
  if (clave >= 0) return clave;
  let mejor = 0;
  ps.forEach((p, i) => { if (p.length > ps[mejor].length) mejor = i; });
  return mejor;
}

/** HTML interior de `#gancho`. "tarjeta" es exactamente el de siempre; los demás, una palabra por id g<j>. */
export function htmlGancho(estilo: EstiloGancho, texto: string, iColor: number): string {
  if (estilo === "tarjeta") return `${esc(texto)}<i></i>`;
  const palabras = palabrasDe(texto).map((w, j) => {
    const color = j === iColor;
    const barra = estilo === "subrayado" && color ? `<i class="barra"></i>` : "";
    return `<span id="g${j}" class="g${color ? " color" : ""}">${esc(w)}${barra}</span>`;
  }).join(" ");
  return estilo === "marca" ? `<b class="franja"></b><span class="texto">${palabras}</span>` : palabras;
}

/** Animación del gancho (dur: cuánto se ve). Todos se van con un fundido en los últimos 0,3 s. */
export function pasosGancho(estilo: EstiloGancho, palabras: number, dur: number): PasoAnim[] {
  const pasos: PasoAnim[] = [];
  switch (estilo) {
    case "tarjeta":
      pasos.push({ metodo: "from", sel: "#gancho", a: { opacity: 0, scale: 0.92, duration: 0.35, ease: "back.out(1.7)" }, t: 0 });
      break;
    case "gigante":
      pasos.push({ metodo: "from", sel: "#gancho", a: { opacity: 0, scale: 0.85, duration: 0.3, ease: "back.out(1.7)" }, t: 0 });
      break;
    case "marca":
      pasos.push({ metodo: "from", sel: "#gancho .franja", a: { scaleX: 0, duration: 0.3, ease: "power3.out" }, t: 0 });
      pasos.push({ metodo: "from", sel: "#gancho .texto", a: { opacity: 0, y: 20, duration: 0.25, ease: "power2.out" }, t: 0.15 });
      break;
    case "subrayado":
      pasos.push({ metodo: "from", sel: "#gancho", a: { opacity: 0, y: 24, duration: 0.3, ease: "power2.out" }, t: 0 });
      pasos.push({ metodo: "to", sel: "#gancho .barra", a: { scaleX: 1, duration: 0.3, ease: "power2.out" }, t: 0.35 });
      break;
    case "golpe":
      for (let j = 0; j < palabras; j++) {
        const t = r2(0.05 + j * 0.12);
        pasos.push({ metodo: "fromTo", sel: `#g${j}`, de: { scale: 1.6, opacity: 0 }, a: { scale: 1, opacity: 1, duration: 0.18, ease: "back.out(2)", immediateRender: false }, t });
        pasos.push({ metodo: "fromTo", sel: "#gancho", de: { x: j % 2 ? 6 : -6 }, a: { x: 0, duration: 0.08, ease: "power2.out", immediateRender: false }, t: r2(t + 0.1) });
      }
      break;
  }
  pasos.push({ metodo: "to", sel: "#gancho", a: { opacity: 0, duration: 0.3, ease: "power2.in" }, t: r2(Math.max(0, dur - 0.3)) });
  return pasos;
}

/** CSS de los estilos nuevos del gancho (la tarjeta vive en estilos.css.ts, como siempre). */
export function cssGancho(formato: Formato, ancho: number, color: string): string {
  const f = TAMANO_GIGANTE[formato];
  const max = ancho - 120;
  const sinTarjeta = `box-sizing: border-box; background: transparent; box-shadow: none; border-radius: 0; max-width: ${max}px;`;
  return `
.gancho.gigante, .gancho.golpe { ${sinTarjeta} padding: 0; color: #ffffff; font: 900 ${f}px/1.05 Figtree, sans-serif; text-transform: uppercase; }
.gancho.gigante .g, .gancho.golpe .g { display: inline-block; -webkit-text-stroke: ${Math.round(f * 0.12)}px #0b0b0b; paint-order: stroke fill; text-shadow: 0 8px 24px rgba(0,0,0,.55); }
.gancho.golpe .g { opacity: 0; }
.gancho .g.color { color: var(--marca); }
.gancho.marca { ${sinTarjeta} padding: 22px 40px 28px; color: ${claro(color) ? "#111111" : "#ffffff"}; font: 900 ${Math.round(f * 0.72)}px/1.1 Figtree, sans-serif; text-transform: uppercase; }
.gancho.marca .franja { position: absolute; inset: 0; z-index: 0; background: var(--marca); border-radius: 18px; transform-origin: 0% 50%; box-shadow: 0 14px 40px rgba(0,0,0,.35); }
.gancho.marca .texto { position: relative; z-index: 1; }
.gancho.marca .g.color { color: inherit; text-decoration: underline; text-decoration-thickness: 6px; text-underline-offset: 8px; }
.gancho.subrayado { ${sinTarjeta} padding: 0; color: #ffffff; font: 900 ${Math.round(f * 0.85)}px/1.1 Figtree, sans-serif; text-transform: uppercase; text-shadow: 0 6px 22px rgba(0,0,0,.6); }
.gancho.subrayado .g { position: relative; display: inline-block; }
.gancho.subrayado .g.color { color: #ffffff; }
.gancho.subrayado .barra { position: absolute; left: 0; right: 0; bottom: -6px; height: ${Math.round(f * 0.1)}px; border-radius: 6px; background: var(--marca); transform: scaleX(0); transform-origin: 0% 50%; z-index: -1; }
`;
}
