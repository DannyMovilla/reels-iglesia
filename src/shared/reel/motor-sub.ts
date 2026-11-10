import type { Bloque } from "./subtitulos";
import type { PasoAnim } from "./pasos";
import { AMARILLO, PRESETS_SUB, type EstiloNuevo } from "./presets-sub";

const r2 = (x: number) => Math.round(x * 100) / 100;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** ¿El color es claro? (para poner texto oscuro encima). */
function claro(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

/** Ancho útil del subtítulo (960 px menos el margen de cada palabra) y ancho medio de una mayúscula de Montserrat 900. */
const ANCHO_UTIL = 940, ANCHO_LETRA = 0.75;

/**
 * HTML interior del bloque de un preset (las palabras con id b<i>w<j>). Con `tamano` (px), si la palabra más larga
 * no entra en el ancho del subtítulo, el bloque se achica lo justo (una palabra no se corta en dos líneas).
 */
export function htmlPreset(id: EstiloNuevo, b: Bloque, i: number, tamano?: number): string {
  const p = PRESETS_SUB[id];
  const html = b.palabras.map((w, j) => {
    const texto = esc(p.mayusculas ? w.texto.toUpperCase() : w.texto);
    const interior = p.activa === "subrayado" ? `<span>${texto}</span><i class="barra"></i>` : texto;
    return `<span id="b${i}w${j}" class="w${w.clave ? " clave" : ""}">${interior}</span>`;
  }).join(" ");
  if (!tamano) return html;
  const grande = p.activa === "ninguna" || p.activa === "brillo" ? 1.25 : 1;
  const ancho = Math.max(...b.palabras.map((w) => w.texto.length * ANCHO_LETRA * tamano * (w.clave ? grande : 1)));
  return ancho > ANCHO_UTIL ? `<span class="ajuste" style="font-size:${Math.floor((ANCHO_UTIL / ancho) * 100) / 100}em">${html}</span>` : html;
}

/** Animación del bloque de un preset. Una palabra que empezó antes del bloque se anima al entrar el bloque. */
export function pasosPreset(id: EstiloNuevo, b: Bloque, i: number, color: string): PasoAnim[] {
  const p = PRESETS_SUB[id];
  const activo = p.colorActiva === "amarillo" ? AMARILLO : color;
  const pasos: PasoAnim[] = [{ metodo: "from", sel: `#b${i}`, a: { opacity: 0, y: 16, duration: 0.12 }, t: r2(b.desde) }];
  b.palabras.forEach((w, j) => {
    const sel = `#b${i}w${j}`;
    const desde = r2(Math.max(b.desde, w.desde)), fin = r2(Math.max(desde, w.hasta) + 0.05);
    const normal = w.clave ? color : "#ffffff";
    switch (p.activa) {
      case "color":
        pasos.push({ metodo: "set", sel, a: { color: activo }, t: desde });
        if (!w.clave) pasos.push({ metodo: "set", sel, a: { color: "#ffffff" }, t: fin });
        break;
      case "escala":
        pasos.push({ metodo: "fromTo", sel, de: { scale: 1.15, color: activo }, a: { scale: 1, duration: 0.18, ease: "power2.out", immediateRender: false }, t: desde });
        pasos.push({ metodo: "to", sel, a: { color: normal, duration: 0.05 }, t: fin });
        break;
      case "caja":
        pasos.push({ metodo: "set", sel, a: { backgroundColor: activo, color: claro(activo) ? "#111111" : "#ffffff" }, t: desde });
        pasos.push({ metodo: "set", sel, a: { backgroundColor: "rgba(0,0,0,0)", color: normal }, t: fin });
        break;
      case "subrayado":
        pasos.push({ metodo: "to", sel: `${sel} .barra`, a: { opacity: 1, scaleX: 1, duration: 0.15, ease: "power2.out" }, t: desde });
        pasos.push({ metodo: "to", sel: `${sel} .barra`, a: { opacity: 0, duration: 0.1, ease: "power2.in" }, t: fin });
        break;
      case "rebote":
        pasos.push({ metodo: "fromTo", sel, de: { y: 40, scale: 0.6, opacity: 0 }, a: { y: 0, scale: 1, opacity: 1, duration: 0.22, ease: "back.out(2.2)", immediateRender: false }, t: desde });
        break;
      case "brillo":
        if (w.clave) pasos.push({ metodo: "to", sel, a: { textShadow: `0 0 14px ${color}, 0 0 34px ${color}, 0 4px 14px rgba(0,0,0,.6)`, duration: 0.2 }, t: desde });
        break;
      case "ninguna":
        if (w.clave) pasos.push({ metodo: "fromTo", sel, de: { scale: 1.3 }, a: { scale: 1, duration: 0.2, ease: "power2.out", immediateRender: false }, t: desde });
        break;
    }
  });
  return pasos;
}

/** CSS de un preset (t = tamaño de letra en px ya ajustado). La fuente es la de subtítulos del clip. */
export function cssPreset(id: EstiloNuevo, t: number): string {
  const p = PRESETS_SUB[id];
  const s = `.sub.${id}`;
  const reglas = [
    `${s} { font: ${p.peso} ${t}px/1.22 Montserrat, sans-serif; letter-spacing: 0.01em; }`,
    p.contorno === "borde"
      ? `${s} .w { -webkit-text-stroke: ${Math.round(t * 0.17)}px #0b0b0b; paint-order: stroke fill; text-shadow: 0 6px 18px rgba(0,0,0,.5); }`
      : `${s} .w { text-shadow: 0 4px 18px rgba(0,0,0,.7); }`,
  ];
  if (p.activa === "caja") reglas.push(`${s} .w { padding: 0 0.18em; border-radius: 14px; }`);
  if (p.activa === "subrayado") {
    reglas.push(`${s} .w { position: relative; }`);
    reglas.push(`${s} .barra { position: absolute; left: 4px; right: 4px; bottom: -4px; height: ${Math.round(t * 0.12)}px; border-radius: 6px; background: var(--marca); opacity: 0; transform: scaleX(0); transform-origin: 0% 50%; }`);
  }
  if (p.activa === "rebote") reglas.push(`${s} .w { opacity: 0; }`);
  if (p.activa === "ninguna" || p.activa === "brillo") reglas.push(`${s} .clave { font-size: 1.25em; }`);
  return reglas.join("\n");
}
