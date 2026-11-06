import type { Escena } from "../tipos";

/**
 * Escenas animadas para los reels de «Con IA»: fondos del catálogo de HyperFrames (Apache 2.0) que usan la
 * librería `shaders` (MIT, resources/escenas/shaders.iife.js). Un solo canvas por reel: la librería anima el
 * primer `canvas[data-shader]` del documento (docs/superpowers/notas/2026-11-06-prueba-fondos-animados.md).
 */
interface DefEscena { nombre: string; shader: string; props(color: string): Record<string, unknown> }

const FONDO = "#0a0c16";

/** Mezcla dos colores #rrggbb (t = 0 → a, t = 1 → b). */
export function mezclar(a: string, b: string, t: number): string {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [c(a), c(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

export const ESCENAS: Record<Escena, DefEscena> = {
  luz: { nombre: "Luz", shader: "Godrays", props: (c) => ({ rayColor: c, backgroundColor: FONDO, center: { x: 0, y: -0.7 }, intensity: 0.85, density: 0.35, speed: 0.4 }) },
  amanecer: { nombre: "Amanecer", shader: "SunBurst", props: (c) => ({ color: c, background: "#1a1030", center: { x: 0.5, y: 0.85 }, rayCount: 10, softness: 0.75, radius: 1, feather: 0.8, speed: 0.12 }) },
  aurora: { nombre: "Aurora", shader: "Aurora", props: (c) => ({ colorA: c, colorB: "#3fd8c0", colorC: "#3a4fd8", intensity: 70, speed: 3 }) },
  nubes: { nombre: "Nubes", shader: "FractalNoise", props: (c) => ({ colorA: "#0d1630", colorB: mezclar(c, "#ffffff", 0.55), contrast: 0.4, speed: 0.12 }) },
  atardecer: { nombre: "Atardecer", shader: "MeshGradient", props: (c) => ({ colorA: "#2a0f3a", colorB: c, swirl: 0.35, speed: 0.6 }) },
  destello: { nombre: "Destello", shader: "LensFlare", props: () => ({ lightPosition: { x: 0.5, y: 0.22 }, intensity: 0.6, haloIntensity: 0.5 }) },
};

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;");

/** Canvas de la escena (con los colores de la marca) + un velo oscuro y viñeta para que el texto se lea. */
export function htmlEscena(escena: Escena, color: string, ancho: number, alto: number): string {
  const e = ESCENAS[escena];
  return `<canvas id="escena" data-shader="${e.shader}" data-shader-props='${attr(JSON.stringify(e.props(color)))}' width="${ancho}" height="${alto}" style="position:absolute;inset:0;width:${ancho}px;height:${alto}px;background:${FONDO}"></canvas>
<div class="velo" style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,.55) 100%), linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.05) 35%, rgba(0,0,0,.35))"></div>`;
}
