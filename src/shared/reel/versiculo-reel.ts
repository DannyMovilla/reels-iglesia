import { htmlPintura, PINTURAS } from "./pinturas";
import type { Creacion, Formato, Marca } from "../tipos";
import { agregarCierre, agregarEfecto, htmlMarcaReel, ALTOS, documento, type EntradaComposicion } from "./composicion";
import { htmlEscena } from "./escenas";
import { cssComposicion } from "./estilos.css";
import { curvaMusica } from "./musica";
import { DURACION_CIERRE, r2 } from "./tiempo";

/**
 * Reel de «Con IA»: gancho → versículo RVR1960 palabra por palabra → referencia → reflexión → cierre,
 * sobre una escena animada, el degradado de la marca, o una foto o un video propio.
 */
export interface EntradaReelVersiculo {
  creacion: Creacion;
  marca: Marca;
  formato: Formato;
  /** gsap y fuentes como en la composición de prédicas; `escenas` = ruta de shaders.iife.js. */
  /** pinturas: carpeta de las pinturas clásicas (recursos/pinturas). */
  recursos: EntradaComposicion["recursos"] & { escenas?: string; pinturas?: string };
  modo: "vista" | "render";
  /** Archivo del fondo propio dentro de la carpeta del reel (o URL en la vista previa). */
  fondoSrc?: string;
  /** Duración del video de fondo, para repetirlo hasta cubrir el reel. */
  fondoDuracion?: number;
  musica?: { src: string };
}

const MAX_PALABRAS = 28;
const ANCHO = 1080;
const GANCHO = 2.5;
const palabrasDe = (t: string) => t.trim().split(/\s+/).filter(Boolean);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (x: number) => String(r2(x));
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, "");

/** El versículo en tarjetas de hasta 28 palabras, cortando en la puntuación más cercana a la mitad. */
export function tarjetasVersiculo(texto: string): string[] {
  const ws = palabrasDe(texto);
  if (ws.length <= MAX_PALABRAS) return ws.length ? [ws.join(" ")] : [];
  const partes = Math.ceil(ws.length / MAX_PALABRAS);
  const objetivo = ws.length / partes;
  const tarjetas: string[] = [];
  let i = 0;
  while (ws.length - i > MAX_PALABRAS) {
    // El corte con puntuación más cercano al largo objetivo, sin pasarse de 28 palabras.
    let mejor = -1;
    for (let j = i + 4; j < Math.min(ws.length - 1, i + MAX_PALABRAS); j++) {
      if (/[.;:,]$/.test(ws[j]) && (mejor < 0 || Math.abs(j + 1 - i - objetivo) < Math.abs(mejor + 1 - i - objetivo))) mejor = j;
    }
    const fin = mejor >= 0 ? mejor + 1 : i + MAX_PALABRAS;
    tarjetas.push(ws.slice(i, fin).join(" "));
    i = fin;
  }
  tarjetas.push(ws.slice(i).join(" "));
  return tarjetas;
}

const lectura = (texto: string, base: number, porPalabra: number, min: number, max: number) =>
  r2(Math.min(max, Math.max(min, base + porPalabra * palabrasDe(texto).length)));

export interface TiemposReelVersiculo {
  gancho: { desde: number; hasta: number };
  tarjetas: { desde: number; hasta: number; texto: string }[];
  reflexion: { desde: number; hasta: number };
  cierre: { desde: number; hasta: number };
  duracion: number;
}

/** Tiempos: gancho 2,5 s; cada tarjeta 0,5 s + 0,3 s/palabra (4–12 s); reflexión 0,5 s + 0,28 s/palabra (3–7 s); cierre 2,6 s. */
export function tiemposReelVersiculo(c: Creacion): TiemposReelVersiculo {
  let t = GANCHO;
  const tarjetas = tarjetasVersiculo(c.versiculo.texto).map((texto) => {
    const d = lectura(texto, 0.5, 0.3, 4, 12);
    const x = { desde: r2(t), hasta: r2(t + d), texto };
    t = r2(t + d);
    return x;
  });
  const dRef = c.reflexion.trim() ? lectura(c.reflexion, 0.5, 0.28, 3, 7) : 0;
  const reflexion = { desde: t, hasta: r2(t + dRef) };
  t = reflexion.hasta;
  const cierre = { desde: t, hasta: r2(t + DURACION_CIERRE) };
  return { gancho: { desde: 0, hasta: GANCHO }, tarjetas, reflexion, cierre, duracion: cierre.hasta };
}

export function construirReelVersiculo(e: EntradaReelVersiculo): { html: string; duracion: number; ancho: number; alto: number } {
  const { creacion: c, marca, formato } = e;
  const W = ANCHO, H = ALTOS[formato];
  const t = tiemposReelVersiculo(c);
  const D = t.duracion;
  const el: string[] = [];
  const js: string[] = [];
  const scripts: string[] = [];

  // Fondo (una pintura que no existe cae en la escena «luz»).
  const pintura = c.fondo.tipo === "pintura" && c.fondo.pintura && PINTURAS[c.fondo.pintura] && e.recursos.pinturas ? c.fondo.pintura : null;
  if (pintura) {
    const h = htmlPintura(pintura, e.recursos.pinturas!, D);
    el.push(...h.el);
    js.push(...h.js);
  } else if ((c.fondo.tipo === "escena" || c.fondo.tipo === "pintura") && e.recursos.escenas) {
    el.push(htmlEscena(c.fondo.tipo === "escena" ? (c.fondo.escena ?? "luz") : "luz", marca.color, W, H));
    scripts.push(e.recursos.escenas);
  } else if (c.fondo.tipo === "imagen" && e.fondoSrc) {
    el.push(`<img id="fondo" class="fondo" src="${esc(e.fondoSrc)}" alt="">`, `<div class="velo-fondo"></div>`);
    js.push(`tl.fromTo("#fondo", { scale: 1 }, { scale: 1.12, duration: ${n(D)}, ease: "none" }, 0);`);
  } else if (c.fondo.tipo === "video" && e.fondoSrc) {
    const dv = Math.max(1, e.fondoDuracion ?? D);
    for (let k = 0, i = 0; k < D; k += dv, i++) {
      el.push(`<video id="fv${i}" class="clip fondo" src="${esc(e.fondoSrc)}" data-start="${n(k)}" data-duration="${n(Math.min(dv, D - k))}" data-media-start="0" data-has-audio="false" muted playsinline></video>`);
    }
    el.push(`<div class="velo-fondo"></div>`);
  } else {
    el.push(`<div class="degradado"><i class="d1"></i><i class="d2"></i></div>`);
    js.push(`tl.fromTo(".degradado .d1", { x: -120, y: -80 }, { x: 140, y: 120, duration: ${n(D)}, ease: "sine.inOut" }, 0);`);
    js.push(`tl.fromTo(".degradado .d2", { x: 120, y: 160 }, { x: -140, y: -60, duration: ${n(D)}, ease: "sine.inOut" }, 0);`);
  }

  // Gancho
  if (c.gancho.trim()) {
    el.push(`<div id="gancho" class="clip gancho-ia" data-start="0" data-duration="${n(t.gancho.hasta)}">${esc(c.gancho)}</div>`);
    js.push(`tl.set("#gancho", { y: 40, scale: 0.94 }, 0);`);
    js.push(`tl.to("#gancho", { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.6)" }, 0.1);`);
    js.push(`tl.to("#gancho", { opacity: 0, y: -30, duration: 0.35, ease: "power2.in" }, ${n(t.gancho.hasta - 0.35)});`);
  }

  // Versículo: cada palabra sube y se ilumina; las clave en el color de la marca.
  const claves = new Set(c.palabrasClave.map(norm).filter((x) => x.length > 2));
  t.tarjetas.forEach((tar, i) => {
    const ws = palabrasDe(tar.texto);
    const spans = ws.map((w, j) => `<span id="t${i}p${j}" class="p${claves.has(norm(w)) ? " clave" : ""}">${esc(w)}</span>`).join(" ");
    const ultima = i === t.tarjetas.length - 1;
    const ref = `<div class="referencia">${esc(c.versiculo.ref)} <small>RVR1960</small></div>`;
    el.push(`<div id="t${i}" class="clip tarjeta" data-start="${n(tar.desde)}" data-duration="${n(tar.hasta - tar.desde)}"><p>${spans}</p>${ultima || t.tarjetas.length === 1 ? ref : `<div class="referencia sigue">${esc(c.versiculo.ref)}</div>`}</div>`);
    const ritmo = Math.min(0.32, ((tar.hasta - tar.desde) * 0.55) / ws.length);
    ws.forEach((_, j) => js.push(`tl.to("#t${i}p${j}", { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, ${n(tar.desde + 0.2 + j * ritmo)});`));
    js.push(`tl.from("#t${i} .referencia", { opacity: 0, y: 16, duration: 0.4 }, ${n(tar.desde + 0.3 + ws.length * ritmo)});`);
    js.push(`tl.to("#t${i}", { opacity: 0, duration: 0.3, ease: "power2.in" }, ${n(tar.hasta - 0.3)});`);
  });

  // Reflexión
  if (t.reflexion.hasta > t.reflexion.desde) {
    el.push(`<div id="reflexion" class="clip reflexion" data-start="${n(t.reflexion.desde)}" data-duration="${n(t.reflexion.hasta - t.reflexion.desde)}">${esc(c.reflexion)}</div>`);
    js.push(`tl.to("#reflexion", { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, ${n(t.reflexion.desde + 0.1)});`);
    js.push(`tl.to("#reflexion", { opacity: 0, duration: 0.3 }, ${n(t.reflexion.hasta - 0.3)});`);
  }

  // Música (sin voz: entra fuerte y queda pareja; la normalización deja el reel en −14 LUFS)
  // Marca abajo durante el reel (solo si la iglesia eligió cómo se ve), hasta el cierre.
  if (marca.marcaReel) {
    const m = htmlMarcaReel(marca, e.recursos.logo, 0, t.cierre.desde);
    if (m) el.push(m);
  }

  // Whoosh suave al entrar cada tarjeta y la reflexión.
  if (e.recursos.efectos && c.sonidos !== false) {
    const momentos = [...t.tarjetas.map((x) => x.desde), ...(t.reflexion.hasta > t.reflexion.desde ? [t.reflexion.desde] : [])];
    for (const m of momentos) agregarEfecto(el, e.recursos.efectos, "whoosh-suave", m - 0.3, 0.35);
  }

  if (e.musica) {
    const puntos = curvaMusica([], D, Math.max(0.3, c.musica.volumen));
    el.push(`<audio id="musica" class="clip" src="${esc(e.musica.src)}" data-start="0" data-duration="${n(D)}" data-volume="1" data-automation='${JSON.stringify({ version: 1, lanes: [{ target: "volume", points: puntos }] })}'></audio>`);
  }

  // Cierre de la marca (con fondo propio para que el logo se lea sobre cualquier escena)
  el.push(`<div id="fondo-cierre" class="clip fondo-cierre" data-start="${n(t.cierre.desde)}" data-duration="${n(t.cierre.hasta - t.cierre.desde)}"></div>`);
  js.push(`tl.from("#fondo-cierre", { opacity: 0, duration: 0.4 }, ${n(t.cierre.desde)});`);
  agregarCierre(el, js, marca, e.recursos, t.cierre.desde, t.cierre.hasta - t.cierre.desde);

  const css = cssComposicion({ ancho: W, alto: H, color: marca.color, fuentes: e.recursos.fuentes, tamanoSub: 70, estiloSub: "pop" }) + cssReelVersiculo(W, H, marca.color);
  return { html: documento(W, H, D, css, e.recursos, e.modo, el, js, scripts), duracion: D, ancho: W, alto: H };
}

function cssReelVersiculo(W: number, H: number, color: string): string {
  const grande = H >= 1900 ? 76 : H >= 1300 ? 66 : 58;
  return `
.degradado { position: absolute; inset: 0; overflow: hidden; background: #0a0c16; }
.degradado i { position: absolute; width: ${Math.round(W * 1.3)}px; height: ${Math.round(W * 1.3)}px; border-radius: 50%; filter: blur(90px); opacity: .55; }
.degradado .d1 { left: -${Math.round(W * 0.35)}px; top: ${Math.round(H * 0.05)}px; background: ${color}; }
.degradado .d2 { right: -${Math.round(W * 0.45)}px; bottom: -${Math.round(W * 0.3)}px; background: #3a4fd8; }
img.fondo, video.fondo, img.pintura { position: absolute; inset: 0; width: ${W}px; height: ${H}px; object-fit: cover; transform-origin: 50% 50%; }
.velo-fondo { position: absolute; inset: 0; background: rgba(5,7,14,.55); backdrop-filter: blur(3px); }
.gancho-ia { position: absolute; left: 70px; right: 70px; top: ${Math.round(H * 0.42)}px; transform: translateY(-50%); text-align: center; color: #fff;
  font: 900 ${grande + 14}px/1.08 Montserrat, sans-serif; text-transform: uppercase; text-shadow: 0 6px 30px rgba(0,0,0,.6); opacity: 0; }
.tarjeta { position: absolute; left: 80px; right: 80px; top: ${Math.round(H * 0.5)}px; transform: translateY(-50%); text-align: center; color: #fff; }
.tarjeta p { margin: 0; font: 800 ${grande}px/1.22 Montserrat, sans-serif; text-shadow: 0 4px 24px rgba(0,0,0,.65); }
.tarjeta .p { display: inline-block; opacity: 0; transform: translateY(26px); }
.tarjeta .clave { color: var(--marca); text-shadow: 0 0 22px var(--marca), 0 4px 24px rgba(0,0,0,.65); }
.referencia { margin-top: 38px; font: 800 ${Math.round(grande * 0.55)}px Figtree, sans-serif; color: var(--marca); letter-spacing: .04em; }
.referencia small { font-weight: 600; font-size: .6em; color: rgba(255,255,255,.75); margin-left: 10px; letter-spacing: .12em; }
.referencia.sigue { opacity: .8; font-size: ${Math.round(grande * 0.4)}px; }
.reflexion { position: absolute; left: 90px; right: 90px; top: ${Math.round(H * 0.5)}px; transform: translateY(-50%); text-align: center; color: #fff;
  font: 800 ${Math.round(grande * 0.82)}px/1.3 Figtree, sans-serif; text-shadow: 0 4px 24px rgba(0,0,0,.65); opacity: 0; }
.fondo-cierre { position: absolute; inset: 0; background: radial-gradient(circle at 50% 40%, #1b2140, #0a0c16 70%); }
`;
}
