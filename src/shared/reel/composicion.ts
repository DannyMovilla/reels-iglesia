import { cssFuentesElegidas } from "./fuentes";
import { colorActivo, htmlFiltroColor, matrizColor } from "./color";
import { dentroDeZona } from "./zonas";
import type { Caras, ClipSpec, EstiloSub, Formato, Marca, Transcripcion } from "../tipos";

export type { Marca };
import { pistaCamara, posicionGancho, type ClaveCamara } from "./encuadre";
import { cssComposicion } from "./estilos.css";
import { bloquesSubtitulos } from "./subtitulos";
import { palabrasDe, partesDelReel, r2 } from "./tiempo";
import { ventanaVersiculo } from "./versiculo";
import { curvaMusica, tramosDeVoz } from "./musica";
import { animarBloque, htmlBloque } from "./estilos-sub";


export interface EntradaComposicion {
  clip: ClipSpec;
  transcripcion: Transcripcion;
  caras: Caras | null;
  marca: Marca;
  formato: Formato;
  /** Tamaño del video original (para encuadrar la cara). */
  dimensiones: { ancho: number; alto: number };
  /** URL del servidor de medios (http://127.0.0.1…) en la vista previa; ruta absoluta del archivo original en el render. */
  fuenteVideo: string;
  /** Rutas relativas a la carpeta del reel (o a reels-comp:// en la vista previa). `logo` solo si la marca tiene logo. */
  /** efectos: carpeta de los WAV de efectos de sonido (sin ella, el reel no lleva efectos). */
  recursos: { gsap: string; fuentes: string; runtime?: string; logo?: string; efectos?: string; fuenteIglesia?: string };
  modo: "vista" | "render";
  /** Voz limpia del proyecto (segundo 0 = inicio del rango de la prédica). Sin ella, el video suena con su audio. */
  voz?: { src: string; inicioRango: number };
  /** Nombre del predicador para el rótulo (del proyecto o de la marca). */
  predicador?: string;
  /** Pista o pad de música (se mezcla bajo la voz con un carril de volumen). */
  musica?: { src: string };
}

export const ALTOS: Record<Formato, number> = { "9:16": 1920, "4:5": 1350, "1:1": 1080 };
const ANCHO = 1080;
const POP = { s: 58, m: 70, l: 84 } as const;
const TAMANOS: Record<EstiloSub, { s: number; m: number; l: number }> = {
  pop: POP, caja: { s: 64, m: 78, l: 94 }, limpio: { s: 50, m: 60, l: 72 }, resaltado: POP, karaoke: POP, impacto: POP, neon: POP,
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (x: number) => String(r2(x));

/** Altos aproximados (px) para mantener los textos dentro de la zona segura común. */
const ALTO_GANCHO = 200, ALTO_VERSICULO = 380, ALTO_ROTULO = 110;

/** Fundido de cada lado de un corte de voz (s). */
export const FUNDIDO = 0.01;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Construye la composición HyperFrames del reel. La misma sirve para la vista previa y para exportar. */
export function construirComposicion(e: EntradaComposicion): { html: string; duracion: number; ancho: number; alto: number; avisos: string[] } {
  const { clip: c, marca, formato } = e;
  const W = ANCHO, H = ALTOS[formato];
  const palabras = palabrasDe(e.transcripcion);
  const partes = partesDelReel(c, palabras);
  const duracion = r2(partes.reduce((a, p) => a + p.duracion, 0));
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

  // Corrección de color: un filtro SVG para todos los videos (sin color o natural sin balance, nada).
  const conColor = colorActivo(c.color);
  if (conColor) el.push(htmlFiltroColor(matrizColor(c.color!.look, c.color!.intensidad, c.color!.balance)));

  let nVideo = 0;
  // Con cortes, cada tramo de voz sube y baja en 10 ms: el salto entre tramos no suena como un "clic".
  const cortado = partes.some((p) => (p.tramos?.length ?? 1) > 1);
  const fundido = (dur: number) => cortado
    ? ` data-automation='${JSON.stringify({ version: 1, lanes: [{ target: "volume", points: [{ t: 0, v: 0 }, { t: FUNDIDO, v: 1 }, { t: r3(Math.max(FUNDIDO, dur - FUNDIDO)), v: 1 }, { t: r3(dur), v: 0 }] }] })}'`
    : "";
  partes.forEach((p) => {
    if (p.tipo === "cierre") return;
    const bn = p.tipo === "apertura"
      ? `filter: ${conColor ? "url(#color) " : ""}grayscale(1) contrast(1.15) brightness(0.95);`
      : conColor ? "filter: url(#color);" : "";
    const tramos = p.tramos ?? [{ inicioVideo: p.inicioVideo, finVideo: p.finVideo, inicioReel: p.inicioReel, duracion: p.duracion }];
    for (const tr of tramos) {
      const i = nVideo++;
      const id = `v${i}`;
      const sonido = e.voz ? `data-has-audio="false" muted` : `data-has-audio="true"`;
      el.push(`<video id="${id}" class="clip video" src="${esc(e.fuenteVideo)}" data-start="${n(tr.inicioReel)}" data-duration="${n(tr.duracion)}" data-media-start="${n(tr.inicioVideo)}" ${sonido} playsinline style="width:${r2(vw)}px;height:${r2(vh)}px;${bn}"></video>`);
      if (e.voz) el.push(`<audio id="voz${i}" class="clip voz" src="${esc(e.voz.src)}" data-start="${n(tr.inicioReel)}" data-duration="${n(tr.duracion)}" data-media-start="${n(tr.inicioVideo - e.voz.inicioRango)}" data-volume="1"${fundido(tr.duracion)}></audio>`);
      const claves: ClaveCamara[] = pista ? pista.keys.filter((k) => k.t >= tr.inicioVideo && k.t <= tr.finVideo) : [];
      const ini = pos(pista ? (claves[0]?.x ?? pista.keys[0].x) : c.encuadre.x, caraY);
      js.push(`tl.set("#${id}", { x: ${ini.x}, y: ${ini.y} }, ${n(tr.inicioReel)});`);
      let previa = ini;
      for (const k of claves) {
        const q = pos(k.x, k.y);
        const t = tr.inicioReel + (k.t - tr.inicioVideo);
        if (Math.abs(q.x - previa.x) > W * 0.6) js.push(`tl.set("#${id}", { x: ${q.x}, y: ${q.y} }, ${n(t)});`);
        else if (q.x !== previa.x || q.y !== previa.y) js.push(`tl.to("#${id}", { x: ${q.x}, y: ${q.y}, duration: 0.5, ease: "sine.inOut", overwrite: "auto" }, ${n(Math.max(tr.inicioReel, t - 0.5))});`);
        previa = q;
      }
    }
    if (p.tipo === "apertura") el.push(`<div id="vineta" class="clip vineta" data-start="${n(p.inicioReel)}" data-duration="${n(p.duracion)}"></div>`);
  });

  const clip = partes.find((p) => p.tipo === "clip")!;
  const apertura = partes.find((p) => p.tipo === "apertura");
  const finVideo = r2(clip.inicioReel + clip.duracion);
  el.push(`<div id="sombra" class="clip sombra" data-start="0" data-duration="${n(finVideo)}"></div>`);

  if (apertura && c.efectos.transicion === "destello") {
    el.push(`<div id="flash" class="clip flash" data-start="${n(clip.inicioReel)}" data-duration="0.3"></div>`);
    js.push(`tl.fromTo("#flash", { opacity: 0.85 }, { opacity: 0, duration: 0.3, ease: "power2.out" }, ${n(clip.inicioReel)});`);
  }
  if (apertura && c.efectos.transicion === "luz") agregarLuz(el, js, Math.max(0, clip.inicioReel - 0.35));
  if (c.efectos.grano) agregarGrano(el, js, finVideo);

  // Gancho: durante la apertura (o los primeros 4,5 s), centrado debajo o encima de la cara.
  const durGancho = c.gancho.trim() ? (apertura ? apertura.duracion : Math.min(4.5, clip.duracion)) : 0;
  // La cara en el cuadro de salida (con zoom y desplazamiento de cámara); su alto ≈ 1,2 × su ancho.
  const cara = { centro: (pos(0.5, caraY).y + caraY * vh) / H, alto: ((pista?.caraAncho ?? 0.06) * vw * 1.2) / H };
  const franjaLibre = Math.round(posicionGancho(cara, formato) * H * 10) / 10;
  if (c.gancho.trim()) {
    const dur = durGancho;
    const top = dentroDeZona(franjaLibre, ALTO_GANCHO, formato);
    el.push(`<div id="gancho" class="clip gancho" data-start="0" data-duration="${n(dur)}" style="top:${top}px">${esc(c.gancho)}<i></i></div>`);
    js.push(`tl.from("#gancho", { opacity: 0, scale: 0.92, duration: 0.35, ease: "back.out(1.7)" }, 0);`);
    js.push(`tl.to("#gancho", { opacity: 0, duration: 0.3, ease: "power2.in" }, ${n(Math.max(0, dur - 0.3))});`);
  }

  // Subtítulos palabra por palabra (la regla del versículo ya viene aplicada).
  if (c.subtitulos.activos) {
    const estilo = c.subtitulos.estilo;
    const altoSub = Math.round(TAMANOS[estilo][c.subtitulos.tamano] * 1.25 * 2 + 20);
    const top = dentroDeZona(r2((formato === "9:16" ? c.subtitulos.altura : 0.8) * H), altoSub, formato);
    bloquesSubtitulos(c, palabras, partes).forEach((b, i) => {
      el.push(`<div id="b${i}" class="clip sub ${estilo}" data-start="${n(b.desde)}" data-duration="${n(Math.max(0.2, b.hasta - b.desde))}" style="top:${top}px">${htmlBloque(estilo, b, i)}</div>`);
      js.push(...animarBloque(estilo, b, i, marca.color));
    });
  }

  // Tarjeta del versículo (RVR1960), debajo de la cara.
  c.versiculos.forEach((v, i) => {
    if (!v.activo) return;
    if (!v.texto.trim()) avisos.push(`${v.ref} no tiene texto RVR1960. Escríbelo en el inspector.`);
    else if (!v.confirmado) avisos.push(`Confirma el texto RVR1960 de ${v.ref} antes de exportar.`);
    const ventana = ventanaVersiculo(v, clip);
    if (!ventana) return;
    const top = dentroDeZona(r2((formato === "9:16" ? 0.62 : 0.6) * H), ALTO_VERSICULO, formato, "arriba");
    const id = `vers${i}`;
    el.push(`<div id="${id}" class="clip vers" data-start="${n(ventana.desde)}" data-duration="${n(ventana.hasta - ventana.desde)}" style="top:${top}px"><b>${esc(v.ref)}<small>RVR1960</small></b>${v.texto.trim() ? `<p>${esc(v.texto)}</p>` : ""}</div>`);
    js.push(`tl.from("#${id}", { x: -${W}, duration: 0.55, ease: "power3.out" }, ${n(ventana.desde)});`);
    js.push(`tl.to("#${id}", { x: -${W}, duration: 0.4, ease: "power2.in" }, ${n(Math.max(ventana.desde + 0.6, ventana.hasta - 0.4))});`);
  });

  // Rótulo del predicador: al empezar el clip (o al irse el gancho), en la franja libre, nunca con el versículo.
  const nombrePredicador = e.predicador?.trim();
  if (c.efectos.rotulo && nombrePredicador) {
    const ventanas = c.versiculos.map((v) => ventanaVersiculo(v, clip)).filter((v): v is NonNullable<typeof v> => v !== null);
    const desde = r2(Math.max(clip.inicioReel + 0.4, durGancho + 0.2));
    let hasta = r2(Math.min(desde + 3, finVideo - 0.2));
    for (const v of ventanas) if (v.hasta > desde && v.desde < hasta) hasta = r2(Math.min(hasta, v.desde - 0.1));
    if (hasta - desde >= 1.2) agregarRotulo(el, js, nombrePredicador, desde, hasta - desde, dentroDeZona(franjaLibre, ALTO_ROTULO, formato));
  }

  if (marca.nombre.trim()) el.push(`<div id="marca" class="clip marca" data-start="0" data-duration="${n(finVideo)}">${esc(marca.nombre)}</div>`);
  el.push(`<div id="prog" class="clip prog" data-start="0" data-duration="${n(finVideo)}"></div>`);
  js.push(`tl.fromTo("#prog", { scaleX: 0 }, { scaleX: 1, duration: ${n(finVideo)}, ease: "none" }, 0);`);

  if (e.musica) {
    const puntos = curvaMusica(tramosDeVoz(partes, palabras), duracion, c.musica.volumen);
    const carril = JSON.stringify({ version: 1, lanes: [{ target: "volume", points: puntos }] });
    el.push(`<audio id="musica" class="clip" src="${esc(e.musica.src)}" data-start="0" data-duration="${n(duracion)}" data-volume="1" data-automation='${carril}'></audio>`);
  }

  const cierre = partes.find((p) => p.tipo === "cierre");
  if (cierre) agregarCierre(el, js, marca, e.recursos, cierre.inicioReel, cierre.duracion);

  // Efectos de sonido: "pop" cuando entra el gancho y "whoosh" en el paso de la apertura al clip y del clip al cierre.
  if (e.recursos.efectos && c.efectos.sonidos !== false) {
    const clipP = partes.find((p) => p.tipo === "clip")!;
    if (c.gancho.trim()) agregarEfecto(el, e.recursos.efectos, "pop", 0.05, 0.4);
    if (partes.some((p) => p.tipo === "apertura")) agregarEfecto(el, e.recursos.efectos, "whoosh", clipP.inicioReel - 0.25, 0.5);
    if (cierre) agregarEfecto(el, e.recursos.efectos, "whoosh", cierre.inicioReel - 0.25, 0.5);
  }

  const css = cssComposicion({ ancho: W, alto: H, color: marca.color, fuentes: e.recursos.fuentes, tamanoSub: TAMANOS[c.subtitulos.estilo][c.subtitulos.tamano], estiloSub: c.subtitulos.estilo })
    + cssFuentesElegidas(c.fuentes, e.recursos.fuenteIglesia);
  return { html: documento(W, H, duracion, css, e.recursos, e.modo, el, js), duracion, ancho: W, alto: H, avisos };
}

const DURACION_EFECTO: Record<"whoosh" | "whoosh-suave" | "pop", number> = { whoosh: 0.6, "whoosh-suave": 0.8, pop: 0.12 };

/** Un efecto de sonido (WAV propio de resources/efectos) en el segundo t del reel. */
export function agregarEfecto(el: string[], carpeta: string, nombre: keyof typeof DURACION_EFECTO, t: number, volumen: number): void {
  const inicio = Math.max(0, Math.round(t * 100) / 100);
  el.push(`<audio class="clip efecto" src="${esc(`${carpeta}/${nombre}.wav`)}" data-start="${n(inicio)}" data-duration="${n(DURACION_EFECTO[nombre])}" data-volume="${volumen}"></audio>`);
}

/** Tarjeta de cierre: logo (sin recortar, tamaño según la marca) o inicial, nombre e invitación. */
export function agregarCierre(el: string[], js: string[], marca: Marca, recursos: EntradaComposicion["recursos"], inicio: number, dur: number): void {
  const lado = Math.round(260 * Math.min(1.5, Math.max(0.5, marca.logoEscala ?? 1)));
  const logo = recursos.logo
    ? `<div class="logo con-imagen" style="width:${lado}px;height:${lado}px"><img src="${esc(recursos.logo)}" alt=""></div>`
    : `<div class="logo">${esc((marca.nombre.trim()[0] ?? "").toUpperCase())}</div>`;
  const usuario = marca.redes?.instagram ?? marca.redes?.tiktok ?? marca.redes?.facebook ?? marca.redes?.youtube;
  const seguir = usuario ? `<div class="seguir"><span class="mas">+</span>Síguenos en <b>@${esc(usuario)}</b></div>` : "";
  el.push(`<div id="cierre" class="clip cierre" data-start="${n(inicio)}" data-duration="${n(dur)}">${logo}<h2>${esc(marca.nombre)}</h2><p>${esc(marca.invitacion)}</p>${seguir}</div>`);
  if (seguir) js.push(`tl.from("#cierre .seguir", { scale: 0.6, opacity: 0, duration: 0.45, ease: "back.out(2.2)" }, ${n(inicio + 0.75)});`);
  js.push(`tl.from("#cierre", { opacity: 0, duration: 0.3 }, ${n(inicio)});`);
  js.push(`tl.from("#cierre .logo", { scale: 0.4, opacity: 0, duration: 0.5, ease: "back.out(2)" }, ${n(inicio + 0.1)});`);
  js.push(`tl.from("#cierre h2, #cierre p", { y: 40, opacity: 0, duration: 0.45, stagger: 0.12, ease: "power3.out" }, ${n(inicio + 0.3)});`);
}

/** Muestra de la marca para la pantalla Marca: la tarjeta de cierre sobre un fondo de ejemplo. */
export function construirMuestraMarca(e: { marca: Marca; recursos: EntradaComposicion["recursos"]; formato: Formato; modo: "vista" | "render" }): { html: string; duracion: number; alto: number } {
  const W = ANCHO, H = ALTOS[e.formato], duracion = 3;
  const el = [`<div id="fondo" class="clip muestra-fondo" data-start="0" data-duration="${duracion}"></div>`];
  const js: string[] = [];
  agregarCierre(el, js, e.marca, e.recursos, 0, duracion);
  const css = cssComposicion({ ancho: W, alto: H, color: e.marca.color, fuentes: e.recursos.fuentes, tamanoSub: POP.m, estiloSub: "pop" });
  return { html: documento(W, H, duracion, css, e.recursos, e.modo, el, js), duracion, alto: H };
}

export function documento(W: number, H: number, duracion: number, css: string, recursos: EntradaComposicion["recursos"], modo: "vista" | "render", el: string[], js: string[], scripts: string[] = []): string {
  const runtime = modo === "vista" && recursos.runtime ? `<script src="${recursos.runtime}"></script>\n` : "";
  // Scripts que buscan elementos del reel al cargar (la librería de escenas busca su canvas): al final del body.
  const alFinal = scripts.map((x) => `<script src="${x}"></script>\n`).join("");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
${runtime}<script src="${recursos.gsap}"></script>
<style>${css}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${n(duracion)}" data-width="${W}" data-height="${H}">
${el.join("\n")}
</div>
${alFinal}<script>
const tl = gsap.timeline({ paused: true });
${js.join("\n")}
window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
`;
}

/** Luz cálida que cruza la pantalla (adaptado de organic-light-leak-overlay del catálogo de HyperFrames, Apache 2.0). */
function agregarLuz(el: string[], js: string[], inicio: number): void {
  el.push(`<div id="luz" class="clip luz" data-start="${n(inicio)}" data-duration="1.1"><i class="ambar"></i><i class="rojo"></i><i class="oro"></i></div>`);
  js.push(`tl.fromTo("#luz", { opacity: 0 }, { opacity: 0.9, duration: 0.35, ease: "sine.out" }, ${n(inicio)});`);
  js.push(`tl.fromTo("#luz .ambar", { x: -260 }, { x: 160, duration: 1.1, ease: "sine.inOut" }, ${n(inicio)});`);
  js.push(`tl.fromTo("#luz .oro", { x: 200, rotation: -8 }, { x: -120, rotation: 4, duration: 1.1, ease: "sine.inOut" }, ${n(inicio)});`);
  js.push(`tl.to("#luz", { opacity: 0, duration: 0.55, ease: "sine.in" }, ${n(inicio + 0.55)});`);
}

/** Grano de película suave (adaptado de grain-overlay, con GSAP en vez de animación CSS para que el render sea exacto). */
function agregarGrano(el: string[], js: string[], dur: number): void {
  el.push(`<div id="grano" class="clip grano" data-start="0" data-duration="${n(dur)}"></div>`);
  js.push(`tl.to("#grano", { x: -18, y: 12, duration: 0.08, ease: "steps(1)", yoyo: true, repeat: ${Math.max(1, Math.floor(dur / 0.08))} }, 0);`);
}

/** Rótulo con el nombre del predicador (adaptado de lt-soft-pill del catálogo de HyperFrames, Apache 2.0). */
function agregarRotulo(el: string[], js: string[], nombre: string, inicio: number, dur: number, top: number): void {
  el.push(`<div id="rotulo" class="clip rotulo" data-start="${n(inicio)}" data-duration="${n(dur)}" style="top:${top}px"><i class="punto"></i><b>${esc(nombre)}</b></div>`);
  js.push(`tl.fromTo("#rotulo", { scale: 0.86, y: 24, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.55, ease: "back.out(1.7)", immediateRender: false }, ${n(inicio)});`);
  js.push(`tl.from("#rotulo .punto", { scale: 0, duration: 0.4, ease: "back.out(3)" }, ${n(inicio + 0.3)});`);
  js.push(`tl.to("#rotulo", { scale: 0.94, y: 14, opacity: 0, duration: 0.35, ease: "power2.in" }, ${n(inicio + dur - 0.35)});`);
}
