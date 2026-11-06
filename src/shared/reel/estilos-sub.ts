import type { EstiloSub } from "../tipos";
import type { Bloque } from "./subtitulos";

/**
 * Estilos de subtítulos. Los cuatro últimos están adaptados de bloques del catálogo de HyperFrames
 * (Apache 2.0, ver NOTICE.md): caption-highlight, caption-pill-karaoke, caption-kinetic-slam y caption-neon-accent,
 * con el color de la marca, fuentes locales y la regla del versículo.
 */
export const NOMBRE_ESTILO: Record<EstiloSub, string> = {
  pop: "Pop", caja: "Caja", limpio: "Limpio", resaltado: "Resaltado", karaoke: "Karaoke", impacto: "Impacto", neon: "Neón",
};
export const ESTILOS_SUB = Object.keys(NOMBRE_ESTILO) as EstiloSub[];

const r2 = (x: number) => Math.round(x * 100) / 100;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** ¿El color es claro? (para poner texto oscuro encima). */
export function esClaro(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

/** HTML interior del bloque (las palabras con id b<i>w<j>). */
export function htmlBloque(estilo: EstiloSub, b: Bloque, i: number): string {
  const palabra = (w: Bloque["palabras"][number], j: number) => {
    const texto = esc(estilo === "limpio" ? w.texto : w.texto.toUpperCase());
    const interior = estilo === "resaltado" ? `<i class="fondo"></i><span>${texto}</span>` : texto;
    return `<span id="b${i}w${j}" class="w${w.clave ? " clave" : ""}">${interior}</span>`;
  };
  const palabras = b.palabras.map(palabra).join(" ");
  return estilo === "karaoke" ? `<span class="pildora">${palabras}</span>` : palabras;
}

/** Animación GSAP del bloque y de cada palabra (tiempos de reel). */
export function animarBloque(estilo: EstiloSub, b: Bloque, i: number, color: string): string[] {
  const js: string[] = [];
  const id = `"#b${i}"`;
  const claro = esClaro(color);
  if (estilo === "neon") {
    js.push(`tl.fromTo(${id}, { opacity: 0, scale: 0.65 }, { opacity: 1, scale: 1, duration: 0.22, ease: "power3.out", immediateRender: false }, ${r2(b.desde)});`);
    const ciclos = Math.max(1, Math.floor((b.hasta - b.desde) / 0.5));
    js.push(`tl.to(${id}, { x: 3, y: 3, duration: 0.25, ease: "sine.inOut", yoyo: true, repeat: ${ciclos * 2 - 1} }, ${r2(b.desde)});`);
    return js;
  }
  if (estilo !== "impacto") js.push(`tl.from(${id}, { opacity: 0, y: 16, duration: 0.12 }, ${r2(b.desde)});`);
  b.palabras.forEach((w, j) => {
    if (w.desde < b.desde) return;
    const sel = `"#b${i}w${j}"`;
    const desde = r2(w.desde), fin = r2(w.hasta + 0.05);
    switch (estilo) {
      case "caja":
        js.push(`tl.set(${sel}, { backgroundColor: "${color}", color: "${claro ? "#111111" : "#ffffff"}" }, ${desde});`);
        js.push(`tl.set(${sel}, { backgroundColor: "rgba(0,0,0,0)", color: "${w.clave ? color : "#ffffff"}" }, ${fin});`);
        break;
      case "resaltado": {
        const fondo = `"#b${i}w${j} .fondo"`;
        js.push(`tl.to(${fondo}, { opacity: 1, scaleX: 1, duration: 0.15, ease: "power2.out" }, ${desde});`);
        js.push(`tl.set(${sel}, { color: "${claro ? "#111111" : "#ffffff"}" }, ${desde});`);
        js.push(`tl.to(${fondo}, { opacity: 0, duration: 0.1, ease: "power2.in" }, ${fin});`);
        js.push(`tl.set(${sel}, { color: "${w.clave ? color : "#ffffff"}" }, ${fin});`);
        break;
      }
      case "karaoke":
        js.push(`tl.to(${sel}, { color: "${w.clave ? color : "#1c1e1d"}", duration: 0.1, ease: "none" }, ${r2(Math.max(b.desde, w.desde - 0.05))});`);
        break;
      case "impacto": {
        const siguiente = b.palabras[j + 1]?.desde ?? b.hasta;
        const entradas = [
          `{ y: -120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: "back.out(1.7)", immediateRender: false }`,
          `{ x: -300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.2, ease: "expo.out", immediateRender: false }`,
          `{ x: 300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.2, ease: "expo.out", immediateRender: false }`,
          `{ scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.24, ease: "back.out(2.2)", immediateRender: false }`,
        ];
        js.push(`tl.fromTo(${sel}, ${entradas[j % 4]}, ${desde});`);
        js.push(`tl.to(${sel}, { opacity: 0, duration: 0.08, ease: "power2.in" }, ${r2(Math.max(w.desde + 0.15, siguiente - 0.02))});`);
        break;
      }
      default: // pop y limpio
        js.push(`tl.fromTo(${sel}, { scale: ${estilo === "pop" ? 1.18 : 1.06}, color: "${color}" }, { scale: 1, duration: 0.18, ease: "power2.out", immediateRender: false }, ${desde});`);
        if (!w.clave) js.push(`tl.to(${sel}, { color: "#ffffff", duration: 0.05 }, ${fin});`);
    }
  });
  return js;
}

/** CSS de los estilos (tamaño base en px, ya ajustado a s/m/l). */
export function cssEstilosSub(t: number): string {
  return `
.sub.resaltado { font: 800 ${t}px/1.35 Montserrat, sans-serif; letter-spacing: 0.02em; }
.sub.resaltado .w { position: relative; padding: 4px 12px 6px; text-shadow: 0 4px 14px rgba(0,0,0,.55); }
.sub.resaltado .w > span { position: relative; z-index: 1; }
.sub.resaltado .fondo { position: absolute; inset: 0; z-index: 0; background: var(--marca); border-radius: 10px; box-shadow: 0 12px 30px rgba(0,0,0,.32); opacity: 0; transform: scaleX(0); transform-origin: 0% 50%; }
.sub.karaoke { font: 800 ${Math.round(t * 0.82)}px/1.25 Figtree, sans-serif; }
.sub.karaoke .pildora { display: inline-block; max-width: 100%; padding: 16px 44px 18px; border-radius: 22px; background: #eceaec; box-shadow: 0 6px 22px rgba(0,0,0,.28); }
.sub.karaoke .w { color: #a6a6a6; margin: 0 0.12em; }
.sub.impacto { font: 900 ${Math.round(t * 1.55)}px/1 Montserrat, sans-serif; letter-spacing: 0.03em; height: ${Math.round(t * 1.6)}px; }
.sub.impacto .w { position: absolute; left: 0; right: 0; opacity: 0; -webkit-text-stroke: ${Math.round(t * 0.16)}px #0b0b0b; paint-order: stroke fill; text-shadow: 0 8px 22px rgba(0,0,0,.5); }
.sub.neon { font: 800 ${t}px/1.15 Montserrat, sans-serif; text-shadow: 0 0 10px rgba(255,255,255,.55), 0 0 24px rgba(255,255,255,.25), 0 4px 14px rgba(0,0,0,.6); }
.sub.neon .clave { font-size: 1.2em; text-shadow: 0 0 12px var(--marca), 0 0 30px var(--marca), 0 4px 14px rgba(0,0,0,.6); }
`;
}
