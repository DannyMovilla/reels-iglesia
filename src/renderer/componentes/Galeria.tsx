import gsap from "gsap";
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { cssEstilosSub, htmlBloque, pasosBloque } from "@shared/reel/estilos-sub";
import { cssGanchoTarjeta, cssSubBase } from "@shared/reel/estilos.css";
import { cssGancho, htmlGancho, palabraEnColor, pasosGancho, type EstiloGancho } from "@shared/reel/gancho";
import type { PasoAnim } from "@shared/reel/pasos";
import { limiteSub, type Bloque } from "@shared/reel/subtitulos";
import { TAMANOS } from "@shared/reel/composicion";
import type { EstiloSub } from "@shared/tipos";

/** Lo que se pinta en una tarjeta de la galería: el mismo HTML, CSS y animación que salen en el reel. */
export interface Muestra {
  html: string;
  css: string;
  pasos: PasoAnim[];
  dur: number;
  /** Elementos que se ven solo un tramo (los bloques de subtítulos). */
  tramos: { sel: string; desde: number; hasta: number }[];
  /** Cuadro fijo (movimiento reducido): el bloque con la palabra clave. */
  fija: string;
}

const ANCHO = 1080, ALTO = 560;
const FRASE = "Tu prueba no es el final";

/** Antepone `raiz` a cada selector, para que el CSS de la muestra no toque el resto de la app. */
export function aislarCss(css: string, raiz: string): string {
  return css.replace(/([^{}]+)\{/g, (_, sel: string) => {
    const previo = /^\s*/.exec(sel)![0];
    return `${previo}${sel.split(",").map((s) => `${raiz} ${s.trim()}`).join(", ")} {`;
  });
}

/** Solo las reglas generales y las del estilo `estilo` (`clase` = "sub" o "gancho"): menos CSS que recalcular por tarjeta. */
export function soloDe(css: string, clase: string, estilo: string): string {
  const otro = new RegExp(`\\.${clase}\\.([a-z]+)`, "g");
  return (css.match(/[^{}]+\{[^{}]*\}/g) ?? []).filter((regla) => {
    const sel = regla.slice(0, regla.indexOf("{"));
    const estilos = [...sel.matchAll(otro)].map((m) => m[1]);
    return estilos.length === 0 || estilos.includes(estilo);
  }).map((r) => r.trim()).join("\n");
}

/** Muestra de un estilo de subtítulos: la frase en bloques como los arma el reel, 0,3 s por palabra. */
export function muestraSub(estilo: EstiloSub, color: string): Muestra {
  const lim = limiteSub(estilo);
  const palabras = FRASE.split(" ").map((t, j) => ({ texto: t, desde: 0.2 + j * 0.3, hasta: 0.45 + j * 0.3, clave: t === "prueba" }));
  const bloques: Bloque[] = [];
  for (const w of palabras) {
    const actual = bloques.at(-1);
    const letras = actual ? actual.palabras.reduce((a, p) => a + p.texto.length + 1, 0) : 0;
    if (!actual || actual.palabras.length >= lim.palabras || letras + w.texto.length > lim.letras) bloques.push({ desde: w.desde, hasta: w.hasta, palabras: [w] });
    else { actual.palabras.push(w); actual.hasta = w.hasta; }
  }
  bloques.forEach((b, i) => { if (bloques[i + 1]) b.hasta = bloques[i + 1].desde; else b.hasta += 0.4; });
  const t = TAMANOS[estilo].m;
  const divs = bloques.map((b, i) => `<div id="b${i}" class="sub ${estilo}" style="top:${ALTO / 2}px">${htmlBloque(estilo, b, i, t)}</div>`);
  return {
    html: divs.join(""),
    fija: divs[Math.max(0, bloques.findIndex((b) => b.palabras.some((w) => w.clave)))],
    css: soloDe(cssSubBase(t) + cssEstilosSub(t), "sub", estilo),
    pasos: bloques.flatMap((b, i) => pasosBloque(estilo, b, i, color)),
    dur: bloques.at(-1)!.hasta,
    tramos: bloques.map((b, i) => ({ sel: `#b${i}`, desde: b.desde, hasta: b.hasta })),
  };
}

/** Muestra de un estilo de gancho con la frase de ejemplo («prueba» en color). */
export function muestraGancho(estilo: EstiloGancho, color: string): Muestra {
  const dur = 2.4;
  const clase = estilo === "tarjeta" ? "gancho" : `gancho ${estilo}`;
  return {
    html: `<div id="gancho" class="${clase}" style="top:${ALTO / 2}px">${htmlGancho(estilo, FRASE, palabraEnColor(FRASE, ["prueba"]))}</div>`,
    css: soloDe(cssGanchoTarjeta(ANCHO) + cssGancho("9:16", ANCHO, color), "gancho", estilo),
    pasos: pasosGancho(estilo, FRASE.split(" ").length, dur),
    dur,
    tramos: [],
    fija: "",
  };
}

const reducido = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function Lienzo({ muestra, color }: { muestra: Muestra; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const quieta = reducido();
  useEffect(() => {
    const raiz = ref.current;
    if (!raiz || quieta) return;
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
    const buscar = (sel: string) => raiz.querySelector(sel);
    for (const tr of muestra.tramos) {
      const el = buscar(tr.sel);
      if (!el) continue;
      tl.set(el, { autoAlpha: 0 }, 0);
      tl.set(el, { autoAlpha: 1 }, tr.desde);
      tl.set(el, { autoAlpha: 0 }, tr.hasta);
    }
    for (const p of muestra.pasos) {
      const el = buscar(p.sel);
      if (!el) continue;
      if (p.metodo === "fromTo") tl.fromTo(el, p.de ?? {}, p.a, p.t);
      else tl[p.metodo](el, p.a, p.t);
    }
    tl.set({}, {}, muestra.dur + 0.4);
    return () => { tl.kill(); };
  }, [muestra, quieta]);
  // Quieta: se ve el bloque con la palabra clave, sin animación.
  const html = quieta && muestra.fija ? muestra.fija : muestra.html;
  return (
    <div className={`muestra-lienzo${quieta ? " quieta" : ""}`} ref={ref} style={{ ["--marca" as string]: color }} aria-hidden="true">
      <style>{aislarCss(muestra.css, ".muestra-lienzo")}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

interface Props<T extends string> {
  etiqueta: string;
  opciones: [T, string][];
  valor: T;
  alCambiar(v: T): void;
  muestra(id: T): Muestra;
  /** Color de la marca para las muestras. */
  color?: string;
}

/** Grilla de estilos con su muestra animada (con el teclado: flechas para moverse y elegir). */
export function Galeria<T extends string>({ etiqueta, opciones, valor, alCambiar, muestra, color = "#f5c542" }: Props<T>) {
  const grupo = useRef<HTMLDivElement>(null);
  // Las muestras solo cambian si cambian los estilos o el color: así un cambio del clip no reinicia las animaciones.
  const ids = opciones.map(([id]) => id).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const muestras = useMemo(() => new Map(opciones.map(([id]) => [id, muestra(id)])), [ids, color]);
  const mover = (e: KeyboardEvent, i: number) => {
    const paso = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    const j = (i + paso + opciones.length) % opciones.length;
    alCambiar(opciones[j][0]);
    grupo.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[j]?.focus();
  };
  return (
    <div className="galeria" role="radiogroup" aria-label={etiqueta} ref={grupo}>
      {opciones.map(([id, nombre], i) => (
        <button key={id} type="button" role="radio" aria-checked={valor === id} aria-label={nombre} tabIndex={valor === id ? 0 : -1}
          className="galeria-opcion" onClick={() => alCambiar(id)} onKeyDown={(e) => mover(e, i)}>
          <span className="muestra-escenario"><Lienzo muestra={muestras.get(id)!} color={color} /></span>
          <span className="galeria-nombre">{nombre}</span>
        </button>
      ))}
    </div>
  );
}
