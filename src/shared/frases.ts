import type { Palabra } from "./reel/tiempo";
import { FUENTES, FUENTES_POR_DEFECTO } from "./reel/fuentes";
import type { Marca } from "./tipos";

/** Frases textuales de la prédica para publicar como imagen (pestaña Entregas). */
export type FondoFrase = "marca" | "momento" | "pintura";
export interface Frase {
  texto: string;
  /** Segundo del video completo donde empieza la frase. */
  en: number;
  /** Lo que dijo el predicador (para avisar si una corrección lo cambia de más). */
  original: string;
  fondo: FondoFrase;
  /** Id de la pintura (si el fondo es "pintura"). */
  pintura?: string;
  /** Palabra de la frase que va en el color de la iglesia. */
  clave?: string;
  /** RVR1960, escrito por Claude: no sale en la imagen hasta que la persona lo confirma. */
  versiculo?: { ref: string; texto: string; confirmado: boolean };
}
/** Lo que propone Claude. */
export interface Candidata { texto: string; en: string; clave?: string; versiculo?: { ref: string; texto: string } }

export const MAX_FRASES = 7;
const MIN_PALABRAS = 6, MAX_PALABRAS = 25, FIDELIDAD = 0.9, VENTANA = 60, REPETIDA = 0.6;

/** Palabras sin tildes, mayúsculas ni puntuación (la ñ se conserva). */
export function normalizarPalabras(s: string): string[] {
  return s.toLowerCase().replace(/ñ/g, "\u0001").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\u0001/g, "ñ")
    .split(/[^a-z0-9ñ]+/).filter(Boolean);
}

/** Largo de la subsecuencia común más larga (las palabras en el mismo orden). */
function lcs(a: string[], b: string[]): number {
  let previa = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const fila = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) fila[j] = a[i - 1] === b[j - 1] ? previa[j - 1] + 1 : Math.max(previa[j], fila[j - 1]);
    previa = fila;
  }
  return previa[b.length];
}

/** Mejor coincidencia de la frase con la transcripción cerca de `en` (±60 s) y dónde empieza. */
function ubicar(frase: string, palabras: Palabra[], en: number): { valor: number; inicio: number } {
  const f = normalizarPalabras(frase);
  if (!f.length) return { valor: 0, inicio: en };
  const ts = palabras.map((w) => ({ s: w.s, n: normalizarPalabras(w.t) })).flatMap((w) => w.n.map((n) => ({ s: w.s, n })));
  let mejor = { valor: 0, inicio: en, empieza: false };
  for (let i = 0; i < ts.length; i++) {
    if (ts[i].s < en - VENTANA) continue;
    if (ts[i].s > en + VENTANA) break;
    const valor = lcs(f, ts.slice(i, i + f.length + 3).map((w) => w.n)) / f.length;
    // A igual coincidencia gana la ventana que empieza en la primera palabra de la frase (su minuto exacto).
    const empieza = ts[i].n === f[0];
    if (valor > mejor.valor || (valor === mejor.valor && empieza && !mejor.empieza)) mejor = { valor, inicio: ts[i].s, empieza };
    if (valor === 1 && empieza) break;
  }
  return { valor: mejor.valor, inicio: mejor.inicio };
}

/** 0–1: qué parte de la frase aparece, en orden, en la transcripción a ±60 s de `en`. */
export function coincidencia(frase: string, palabras: Palabra[], en: number): number {
  return ubicar(frase, palabras, en).valor;
}

/** "1:05", "0:01:05" o "0:01:05.4" → segundos; NaN si no se puede leer. */
function segundos(t: string): number {
  const m = /^\s*(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)\s*$/.exec(t ?? "");
  if (!m) return NaN;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Las palabras en común sobre las de la más corta. */
function parecido(a: string, b: string): number {
  const A = new Set(normalizarPalabras(a)), B = new Set(normalizarPalabras(b));
  let comunes = 0;
  for (const x of A) if (B.has(x)) comunes++;
  return comunes / Math.max(1, Math.min(A.size, B.size));
}

/**
 * Las frases que sí dijo el predicador: en el orden de Claude, sin las que no se pueden leer, fuera de la prédica,
 * muy cortas o largas, inventadas (< 90 %) o repetidas; como mucho 7, ordenadas por minuto.
 */
export function elegirFrases(candidatas: Candidata[], palabras: Palabra[], rango: { inicio: number; fin: number }): Frase[] {
  const elegidas: Frase[] = [];
  for (const c of candidatas) {
    if (elegidas.length >= MAX_FRASES) break;
    const texto = typeof c?.texto === "string" ? c.texto.replace(/\s+/g, " ").trim() : "";
    const n = normalizarPalabras(texto).length;
    const en = segundos(c?.en);
    if (n < MIN_PALABRAS || n > MAX_PALABRAS || !Number.isFinite(en) || en < rango.inicio || en > rango.fin) continue;
    const u = ubicar(texto, palabras, en);
    if (u.valor < FIDELIDAD) continue;
    if (elegidas.some((f) => parecido(f.texto, texto) > REPETIDA)) continue;
    const v = c.versiculo;
    const clave = typeof c.clave === "string" ? c.clave.trim() : "";
    const primera = normalizarPalabras(clave)[0];
    const conClave = !!primera && normalizarPalabras(texto).includes(primera);
    elegidas.push({
      texto, en: Math.round(u.inicio * 100) / 100, original: texto, fondo: "marca", ...(conClave ? { clave } : {}),
      ...(typeof v?.ref === "string" && typeof v.texto === "string" && v.ref.trim() && v.texto.trim()
        ? { versiculo: { ref: v.ref.trim(), texto: v.texto.trim(), confirmado: false } } : {}),
    });
  }
  return elegidas.sort((a, b) => a.en - b.en);
}

/** ¿La frase (quizá corregida) sigue siendo lo que dijo el predicador? */
export function fiel(f: Frase): boolean {
  const a = normalizarPalabras(f.texto), b = normalizarPalabras(f.original);
  return lcs(a, b) / Math.max(1, a.length, b.length) >= FIDELIDAD;
}

/** Palabras que puede tener una frase para publicar (las que elige Claude). */
export const MAX_PALABRAS_FRASE = 25;
/** Una frase editada más larga se corta aquí con «…» para que la imagen no se desborde. */
export const TOPE_PALABRAS_IMAGEN = 40;

/** Tamaño de letra de la frase en la imagen: 96 px hasta 8 palabras, 56 px con 25 y baja hasta 44 px con 40. */
export function tamanoFrase(texto: string): number {
  const n = normalizarPalabras(texto).length;
  if (n <= MAX_PALABRAS_FRASE) return Math.min(96, Math.max(56, Math.round(96 - ((n - 8) * 40) / 17)));
  return Math.max(44, Math.round(56 - ((n - MAX_PALABRAS_FRASE) * 12) / (TOPE_PALABRAS_IMAGEN - MAX_PALABRAS_FRASE)));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface DatosTarjeta {
  frase: Frase;
  marca: Marca;
  predicador?: string;
  /** Palabras clave: la primera que aparece en la frase va en color. */
  claves: string[];
  /** src: imagen del fondo (cuadro del momento o pintura). */
  fondo: { tipo: FondoFrase; src?: string };
  /** Carpeta (URL) de las fuentes incluidas. */
  fuentes: string;
  logo?: string;
  /** URL de la fuente propia de la iglesia. */
  fuentePropia?: string;
}

/** Documento HTML de 1080×1350 (sin scripts) con la frase lista para publicar. */
export function htmlTarjetaFrase(d: DatosTarjeta): string {
  const { frase, marca } = d;
  const claves = new Set(d.claves.flatMap(normalizarPalabras));
  let coloreada = false;
  const palabras = frase.texto.trim().split(/\s+/);
  const corto = palabras.length > TOPE_PALABRAS_IMAGEN ? `${palabras.slice(0, TOPE_PALABRAS_IMAGEN).join(" ")}…` : frase.texto;
  const texto = corto.split(/(\s+)/).map((p) => {
    if (/^\s+$/.test(p)) return p;
    const n = normalizarPalabras(p)[0];
    if (!coloreada && n && claves.has(n)) {
      coloreada = true;
      return `<span class="clave">${esc(p)}</span>`;
    }
    return esc(p);
  }).join("");
  const idTitulos = marca.estilo.fuentes?.titulos ?? FUENTES_POR_DEFECTO.titulos;
  const usarPropia = idTitulos === "iglesia" && !!d.fuentePropia;
  const familia = usarPropia ? FUENTES.iglesia.familia : FUENTES[idTitulos === "iglesia" ? FUENTES_POR_DEFECTO.titulos : idTitulos].familia;
  const fondo = d.fondo.tipo === "marca" || !d.fondo.src
    ? `<div class="fondo" style="background: linear-gradient(160deg, ${marca.color} 0%, #0b0d14 78%);"></div>`
    : `<img class="fondo foto${d.fondo.tipo === "momento" ? " momento" : ""}" src="${esc(d.fondo.src)}" alt=""><div class="velo"></div>`;
  const modo = marca.marcaReel?.modo ?? "texto";
  const conLogo = (modo === "logo" || modo === "ambos") && d.logo;
  const pie = [conLogo ? `<img class="logo" src="${esc(d.logo!)}" alt="">` : "", !conLogo || modo === "ambos" ? `<b>${esc(marca.nombre)}</b>` : ""].join("");
  const v = frase.versiculo?.confirmado ? `<p class="vers">«${esc(frase.versiculo.texto)}» ${esc(frase.versiculo.ref)} · RVR1960</p>` : "";
  const f = d.fuentes;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face { font-family: "Figtree"; font-weight: 800; src: url("${f}/figtree/files/figtree-latin-800-normal.woff2") format("woff2"); }
@font-face { font-family: "Figtree"; font-weight: 600; src: url("${f}/figtree/files/figtree-latin-600-normal.woff2") format("woff2"); }
@font-face { font-family: "Montserrat"; font-weight: 800; src: url("${f}/montserrat/files/montserrat-latin-800-normal.woff2") format("woff2"); }
${usarPropia ? `@font-face { font-family: "Fuente iglesia"; src: url("${esc(d.fuentePropia!)}"); }` : ""}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1350px; overflow: hidden; background: #0b0d14; }
.tarjeta { position: relative; width: 1080px; height: 1350px; overflow: hidden; color: #fff; font-family: ${familia}; }
.fondo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.foto.momento { filter: blur(6px) brightness(.45); transform: scale(1.06); }
.velo { position: absolute; inset: 0; background: rgba(0,0,0,.5); }
.cuerpo { position: absolute; left: 100px; right: 100px; top: 0; bottom: 230px; display: flex; flex-direction: column; justify-content: center; gap: 36px; }
.comillas { font: 800 220px/0.6 Georgia, serif; color: ${marca.color}; height: 110px; }
.frase { font-weight: 800; font-size: ${tamanoFrase(frase.texto)}px; line-height: 1.18; letter-spacing: -0.01em; text-shadow: 0 6px 24px rgba(0,0,0,.45); }
.clave { color: ${marca.color}; }
.predicador { font: 600 40px/1.2 Figtree, sans-serif; color: rgba(255,255,255,.85); }
.predicador::before { content: ""; display: inline-block; width: 48px; height: 6px; border-radius: 3px; background: ${marca.color}; vertical-align: middle; margin-right: 18px; }
.vers { font: 600 32px/1.35 Figtree, sans-serif; color: rgba(255,255,255,.85); }
.pie { position: absolute; left: 0; right: 0; bottom: 90px; display: flex; align-items: center; justify-content: center; gap: 20px; font: 700 40px Figtree, sans-serif; }
.logo { height: ${Math.round(110 * (marca.marcaReel?.tamano ?? 1))}px; width: auto; max-width: 60%; object-fit: contain; }
</style></head><body><div class="tarjeta">${fondo}<div class="cuerpo"><div class="comillas">“</div><p class="frase">${texto}</p>${d.predicador?.trim() ? `<p class="predicador">${esc(d.predicador.trim())}</p>` : ""}${v}</div><div class="pie">${pie}</div></div></body></html>`;
}
