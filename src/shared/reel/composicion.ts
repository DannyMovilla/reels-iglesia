import type { Caras, ClipSpec, EstiloSub, Formato, Marca, Transcripcion } from "../tipos";

export type { Marca };
import { pistaCamara, posicionGancho, type ClaveCamara } from "./encuadre";
import { cssComposicion } from "./estilos.css";
import { bloquesSubtitulos } from "./subtitulos";
import { palabrasDe, partesDelReel, r2 } from "./tiempo";
import { ventanaVersiculo } from "./versiculo";


export interface EntradaComposicion {
  clip: ClipSpec;
  transcripcion: Transcripcion;
  caras: Caras | null;
  marca: Marca;
  formato: Formato;
  /** Tamaño del video original (para encuadrar la cara). */
  dimensiones: { ancho: number; alto: number };
  /** reels-video://… en la vista previa; ruta absoluta del archivo original en el render. */
  fuenteVideo: string;
  recursos: { gsap: string; fuentes: string; runtime?: string };
  modo: "vista" | "render";
}

export const ALTOS: Record<Formato, number> = { "9:16": 1920, "4:5": 1350, "1:1": 1080 };
const ANCHO = 1080;
const POP = { s: 58, m: 70, l: 84 } as const;
const TAMANOS: Record<EstiloSub, { s: number; m: number; l: number }> = {
  pop: POP, caja: { s: 64, m: 78, l: 94 }, limpio: { s: 50, m: 60, l: 72 }, resaltado: POP, karaoke: POP, impacto: POP, neon: POP,
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (x: number) => String(r2(x));

/** Construye la composición HyperFrames del reel. La misma sirve para la vista previa y para exportar. */
export function construirComposicion(e: EntradaComposicion): { html: string; duracion: number; ancho: number; alto: number; avisos: string[] } {
  const { clip: c, marca, formato } = e;
  const W = ANCHO, H = ALTOS[formato];
  const partes = partesDelReel(c);
  const duracion = r2(partes.reduce((a, p) => a + p.duracion, 0));
  const palabras = palabrasDe(e.transcripcion);
  const avisos: string[] = [];
  const el: string[] = [];
  const js: string[] = [];

  // Encuadre: el video llena el alto (con zoom) y la cámara sigue la cara con transformaciones x/y.
  const esc0 = (H / e.dimensiones.alto) * (c.encuadre.zoom || 1);
  const vw = Math.max(W, e.dimensiones.ancho * esc0), vh = Math.max(H, e.dimensiones.alto * esc0);
  const pos = (x: number, y: number) => ({
    x: r2(Math.min(0, Math.max(W - vw, W / 2 - x * vw))),
    y: r2(Math.min(0, Math.max(H - vh, H * 0.33 - y * vh))),
  });
  const pista = c.encuadre.modo === "auto" && e.caras ? pistaCamara(e.caras, Math.min(...partes.filter((p) => p.tipo !== "cierre").map((p) => p.inicioVideo)), c.fin) : null;
  const caraY = pista?.caraY ?? 0.3;

  partes.forEach((p, i) => {
    if (p.tipo === "cierre") return;
    const id = `v${i}`;
    const bn = p.tipo === "apertura" ? "filter: grayscale(1) contrast(1.15) brightness(0.95);" : "";
    el.push(`<video id="${id}" class="clip video" src="${esc(e.fuenteVideo)}" data-start="${n(p.inicioReel)}" data-duration="${n(p.duracion)}" data-media-start="${n(p.inicioVideo)}" data-has-audio="true" playsinline style="width:${r2(vw)}px;height:${r2(vh)}px;${bn}"></video>`);
    const claves: ClaveCamara[] = pista ? pista.keys.filter((k) => k.t >= p.inicioVideo && k.t <= p.finVideo) : [];
    const ini = pos(pista ? (claves[0]?.x ?? pista.keys[0].x) : c.encuadre.x, caraY);
    js.push(`tl.set("#${id}", { x: ${ini.x}, y: ${ini.y} }, ${n(p.inicioReel)});`);
    let previa = ini;
    for (const k of claves) {
      const q = pos(k.x, k.y);
      const t = p.inicioReel + (k.t - p.inicioVideo);
      if (Math.abs(q.x - previa.x) > W * 0.6) js.push(`tl.set("#${id}", { x: ${q.x}, y: ${q.y} }, ${n(t)});`);
      else if (q.x !== previa.x || q.y !== previa.y) js.push(`tl.to("#${id}", { x: ${q.x}, y: ${q.y}, duration: 0.5, ease: "sine.inOut", overwrite: "auto" }, ${n(Math.max(p.inicioReel, t - 0.5))});`);
      previa = q;
    }
    if (p.tipo === "apertura") el.push(`<div id="vineta" class="clip vineta" data-start="${n(p.inicioReel)}" data-duration="${n(p.duracion)}"></div>`);
  });

  const clip = partes.find((p) => p.tipo === "clip")!;
  const apertura = partes.find((p) => p.tipo === "apertura");
  const finVideo = r2(clip.inicioReel + clip.duracion);
  el.push(`<div id="sombra" class="clip sombra" data-start="0" data-duration="${n(finVideo)}"></div>`);

  if (apertura) {
    el.push(`<div id="flash" class="clip flash" data-start="${n(clip.inicioReel)}" data-duration="0.3"></div>`);
    js.push(`tl.fromTo("#flash", { opacity: 0.85 }, { opacity: 0, duration: 0.3, ease: "power2.out" }, ${n(clip.inicioReel)});`);
  }

  // Gancho: durante la apertura (o los primeros 4,5 s), centrado debajo o encima de la cara.
  if (c.gancho.trim()) {
    const dur = apertura ? apertura.duracion : Math.min(4.5, clip.duracion);
    // La cara en el cuadro de salida (con zoom y desplazamiento de cámara); su alto ≈ 1,2 × su ancho.
    const cara = { centro: (pos(0.5, caraY).y + caraY * vh) / H, alto: ((pista?.caraAncho ?? 0.06) * vw * 1.2) / H };
    const top = Math.round(posicionGancho(cara, formato) * H * 10) / 10;
    el.push(`<div id="gancho" class="clip gancho" data-start="0" data-duration="${n(dur)}" style="top:${top}px">${esc(c.gancho)}<i></i></div>`);
    js.push(`tl.from("#gancho", { opacity: 0, scale: 0.92, duration: 0.35, ease: "back.out(1.7)" }, 0);`);
    js.push(`tl.to("#gancho", { opacity: 0, duration: 0.3, ease: "power2.in" }, ${n(Math.max(0, dur - 0.3))});`);
  }

  // Subtítulos palabra por palabra (la regla del versículo ya viene aplicada).
  if (c.subtitulos.activos) {
    const estilo = c.subtitulos.estilo;
    const top = r2((formato === "9:16" ? c.subtitulos.altura : 0.8) * H);
    bloquesSubtitulos(c, palabras, partes).forEach((b, i) => {
      const spans = b.palabras.map((w, j) => `<span id="b${i}w${j}" class="w${w.clave ? " clave" : ""}">${esc(estilo === "limpio" ? w.texto : w.texto.toUpperCase())}</span>`).join(" ");
      el.push(`<div id="b${i}" class="clip sub ${estilo}" data-start="${n(b.desde)}" data-duration="${n(Math.max(0.2, b.hasta - b.desde))}" style="top:${top}px">${spans}</div>`);
      js.push(`tl.from("#b${i}", { opacity: 0, y: 16, duration: 0.12 }, ${n(b.desde)});`);
      b.palabras.forEach((w, j) => {
        if (w.desde < b.desde) return;
        const sel = `"#b${i}w${j}"`;
        if (estilo === "caja") {
          js.push(`tl.set(${sel}, { backgroundColor: "${marca.color}", color: "#111111" }, ${n(w.desde)});`);
          js.push(`tl.set(${sel}, { backgroundColor: "rgba(0,0,0,0)", color: "${w.clave ? marca.color : "#ffffff"}" }, ${n(w.hasta + 0.05)});`);
        } else {
          js.push(`tl.fromTo(${sel}, { scale: ${estilo === "pop" ? 1.18 : 1.06}, color: "${marca.color}" }, { scale: 1, duration: 0.18, ease: "power2.out", immediateRender: false }, ${n(w.desde)});`);
          if (!w.clave) js.push(`tl.to(${sel}, { color: "#ffffff", duration: 0.05 }, ${n(w.hasta + 0.05)});`);
        }
      });
    });
  }

  // Tarjeta del versículo (RVR1960), debajo de la cara.
  c.versiculos.forEach((v, i) => {
    if (!v.activo) return;
    if (!v.texto.trim()) avisos.push(`${v.ref} no tiene texto RVR1960. Escríbelo en el inspector.`);
    else if (!v.confirmado) avisos.push(`Confirma el texto RVR1960 de ${v.ref} antes de exportar.`);
    const ventana = ventanaVersiculo(v, clip);
    if (!ventana) return;
    const top = r2((formato === "9:16" ? 0.62 : 0.6) * H);
    const id = `vers${i}`;
    el.push(`<div id="${id}" class="clip vers" data-start="${n(ventana.desde)}" data-duration="${n(ventana.hasta - ventana.desde)}" style="top:${top}px"><b>${esc(v.ref)}<small>RVR1960</small></b>${v.texto.trim() ? `<p>${esc(v.texto)}</p>` : ""}</div>`);
    js.push(`tl.from("#${id}", { x: -${W}, duration: 0.55, ease: "power3.out" }, ${n(ventana.desde)});`);
    js.push(`tl.to("#${id}", { x: -${W}, duration: 0.4, ease: "power2.in" }, ${n(Math.max(ventana.desde + 0.6, ventana.hasta - 0.4))});`);
  });

  if (marca.nombre.trim()) el.push(`<div id="marca" class="clip marca" data-start="0" data-duration="${n(finVideo)}">${esc(marca.nombre)}</div>`);
  el.push(`<div id="prog" class="clip prog" data-start="0" data-duration="${n(finVideo)}"></div>`);
  js.push(`tl.fromTo("#prog", { scaleX: 0 }, { scaleX: 1, duration: ${n(finVideo)}, ease: "none" }, 0);`);

  const cierre = partes.find((p) => p.tipo === "cierre");
  if (cierre) {
    const logo = marca.logo ? `<img src="${esc(marca.logo)}" alt="">` : esc((marca.nombre.trim()[0] ?? "").toUpperCase());
    el.push(`<div id="cierre" class="clip cierre" data-start="${n(cierre.inicioReel)}" data-duration="${n(cierre.duracion)}"><div class="logo">${logo}</div><h2>${esc(marca.nombre)}</h2><p>${esc(marca.invitacion)}</p></div>`);
    js.push(`tl.from("#cierre", { opacity: 0, duration: 0.3 }, ${n(cierre.inicioReel)});`);
    js.push(`tl.from("#cierre .logo", { scale: 0.4, opacity: 0, duration: 0.5, ease: "back.out(2)" }, ${n(cierre.inicioReel + 0.1)});`);
    js.push(`tl.from("#cierre h2, #cierre p", { y: 40, opacity: 0, duration: 0.45, stagger: 0.12, ease: "power3.out" }, ${n(cierre.inicioReel + 0.3)});`);
  }

  const css = cssComposicion({ ancho: W, alto: H, color: marca.color, fuentes: e.recursos.fuentes, tamanoSub: TAMANOS[c.subtitulos.estilo][c.subtitulos.tamano], estiloSub: c.subtitulos.estilo });
  const runtime = e.modo === "vista" && e.recursos.runtime ? `<script src="${e.recursos.runtime}"></script>\n` : "";
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
${runtime}<script src="${e.recursos.gsap}"></script>
<style>${css}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${n(duracion)}" data-width="${W}" data-height="${H}">
${el.join("\n")}
</div>
<script>
const tl = gsap.timeline({ paused: true });
${js.join("\n")}
window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
`;
  return { html, duracion, ancho: W, alto: H, avisos };
}
