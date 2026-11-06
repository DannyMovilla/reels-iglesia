// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { construirComposicion, type EntradaComposicion } from "../../../src/shared/reel/composicion";
import { partesDelReel } from "../../../src/shared/reel/tiempo";
import { ventanaVersiculo } from "../../../src/shared/reel/versiculo";
import type { Caras, ClipSpec, Formato, Transcripcion } from "../../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3 } from "../../ayuda/plan3";

const muestra: Transcripcion = JSON.parse(readFileSync(join(resolve(__dirname, "../../fixtures"), "transcripcion-muestra.json"), "utf8"));
const caras: Caras = Array.from({ length: 160 }, (_, i) => [i * 0.5, [[0.5, 0.25, 0.06, 0.9]]]);
const TEXTO = "Los sacrificios de Dios son el espíritu quebrantado; al corazón contrito y humillado no despreciarás tú, oh Dios.";

const clip = (extra: Partial<ClipSpec> = {}): ClipSpec => ({
  id: "c", titulo: "El quebrantamiento", gancho: "Tu quebranto abre el cielo", ganchosAlternativos: [], categoria: "Exhortación",
  inicio: 30.93, fin: 63.46, apertura: { activa: true, inicio: 39.02, fin: 44.8, frase: "ese quebrantamiento" },
  palabrasClave: ["quebrantamiento"], versiculos: [{ ref: "Salmos 51:17", texto: TEXTO, en: 16.29, activo: true, confirmado: true }],
  puntaje: 90, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3,
  cierre: true, formatos: ["9:16"], estado: "sugerido", ...extra,
});

const entrada = (formato: Formato = "9:16", c = clip()): EntradaComposicion => ({
  clip: c, transcripcion: muestra, caras, formato, dimensiones: { ancho: 1280, alto: 720 },
  marca: { nombre: "Iglesia Familia", color: "#f5c542", invitacion: "Síguenos · Domingos 10:00 AM", ...MARCA_PLAN3 },
  fuenteVideo: "C:/Descargas/culto (1280p).mp4", recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes" }, modo: "render",
});

const dom = (html: string) => new DOMParser().parseFromString(html, "text/html");

test("tamaño y duración por formato", () => {
  for (const [f, alto] of [["9:16", 1920], ["4:5", 1350], ["1:1", 1080]] as const) {
    const r = construirComposicion(entrada(f));
    const raiz = dom(r.html).querySelector("[data-composition-id]")!;
    expect([raiz.getAttribute("data-width"), raiz.getAttribute("data-height")]).toEqual(["1080", String(alto)]);
    expect(Number(raiz.getAttribute("data-duration"))).toBe(40.91);
    expect([r.ancho, r.alto, r.duracion]).toEqual([1080, alto, 40.91]);
  }
});

test("un video por parte con media-start del original, apertura en B/N y destello al entrar al clip", () => {
  const d = dom(construirComposicion(entrada()).html);
  const videos = [...d.querySelectorAll("video")];
  expect(videos.map((v) => v.getAttribute("data-media-start"))).toEqual(["39.02", "30.93"]);
  for (const v of videos) {
    expect(v.getAttribute("src")).toBe("C:/Descargas/culto (1280p).mp4");
    expect(v.getAttribute("data-has-audio")).toBe("true");
  }
  expect(videos[0].getAttribute("style")).toContain("grayscale(1)");
  expect(videos[1].getAttribute("style") ?? "").not.toContain("grayscale");
  expect(d.querySelector("#flash")!.getAttribute("data-start")).toBe("5.78");
});

test("ningún subtítulo empieza dentro de la ventana del versículo y la tarjeta dice RVR1960", () => {
  const c = clip();
  const d = dom(construirComposicion(entrada("9:16", c)).html);
  const v = ventanaVersiculo(c.versiculos[0], partesDelReel(c)[1])!;
  const subs = [...d.querySelectorAll(".sub")];
  expect(subs.length).toBeGreaterThan(5);
  for (const s of subs) {
    const ini = Number(s.getAttribute("data-start"));
    expect(ini >= v.desde && ini < v.hasta).toBe(false);
  }
  const vers = d.querySelector(".vers")!;
  expect(vers.textContent).toContain("Salmos 51:17");
  expect(vers.textContent).toContain("RVR1960");
  expect(vers.textContent).toContain("Los sacrificios de Dios");
});

test("cierre de 2,6 s con nombre e invitación de la marca", () => {
  const cierre = dom(construirComposicion(entrada()).html).querySelector("#cierre")!;
  expect(cierre.getAttribute("data-start")).toBe("38.31");
  expect(cierre.getAttribute("data-duration")).toBe("2.6");
  expect(cierre.textContent).toContain("Iglesia Familia");
  expect(cierre.textContent).toContain("Síguenos · Domingos 10:00 AM");
});

const topGancho = (r: { html: string }) => Number(/top:([\d.]+)px/.exec((dom(r.html).querySelector("#gancho") as HTMLElement).getAttribute("style")!)![1]);

test("el gancho va debajo de la cara cuando la cara está arriba (9:16, zoom 1,25)", () => {
  // cara en y 0,25 del video → en la salida ocupa ~0,17–0,43 del alto
  expect(topGancho(construirComposicion(entrada())) / 1920).toBeGreaterThan(0.45);
});

test("con zoom 1 y la cara a media altura el gancho no cae sobre la boca: va arriba", () => {
  const carasMedio: Caras = Array.from({ length: 160 }, (_, i) => [i * 0.5, [[0.5, 0.45, 0.06, 0.9]]]);
  const r = construirComposicion({ ...entrada("9:16", clip({ encuadre: { modo: "auto", x: 0.5, zoom: 1 } })), caras: carasMedio });
  expect(topGancho(r) / 1920).toBeLessThan(0.3);
});

test("sin recursos de internet y con el texto escapado", () => {
  const r = construirComposicion(entrada("9:16", clip({ gancho: "<script>alert(1)</script> ¿Oras?" })));
  expect(r.html).not.toMatch(/https?:\/\//);
  expect(r.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; ¿Oras?");
});

test("la cámara se mueve con transformaciones (x/y), nunca con left/top", () => {
  const r = construirComposicion(entrada());
  expect(r.html).not.toMatch(/tl\.(to|set|fromTo)\("#v\d", \{[^}]*\b(left|top):/);
  expect(r.html).toMatch(/tl\.(to|set)\("#v1", \{ x:/);
});

test("la vista previa incluye el runtime local; el render no", () => {
  expect(construirComposicion({ ...entrada(), modo: "vista", recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", runtime: "recursos/hyperframe.runtime.iife.js" } }).html)
    .toContain('src="recursos/hyperframe.runtime.iife.js"');
  expect(construirComposicion(entrada()).html).not.toContain("hyperframe.runtime");
});

test("avisos: versículo sin texto o sin confirmar", () => {
  const sinTexto = construirComposicion(entrada("9:16", clip({ versiculos: [{ ref: "Juan 3:16", texto: "", en: 3, activo: true, confirmado: false }] })));
  expect(sinTexto.avisos).toContain("Juan 3:16 no tiene texto RVR1960. Escríbelo en el inspector.");
  const sinConfirmar = construirComposicion(entrada("9:16", clip({ versiculos: [{ ref: "Juan 3:16", texto: TEXTO, en: 3, activo: true, confirmado: false }] })));
  expect(sinConfirmar.avisos).toContain("Confirma el texto RVR1960 de Juan 3:16 antes de exportar.");
});

test("el logo del cierre no se recorta y su tamaño sigue a la marca", async () => {
  const conLogo = (logoEscala: number) => dom(construirComposicion({
    ...entrada(), marca: { ...entrada().marca, logo: "C:/datos/marca/logo.png", logoEscala },
    recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", logo: "recursos/logo.png" },
  }).html).querySelector("#cierre .logo") as HTMLElement;
  const grande = conLogo(1.5);
  expect(grande.classList.contains("con-imagen")).toBe(true);
  expect(grande.getAttribute("style")).toContain("width:390px");
  expect(grande.querySelector("img")!.getAttribute("src")).toBe("recursos/logo.png");
  expect(conLogo(0.5).getAttribute("style")).toContain("width:130px");
  const { cssComposicion } = await import("../../../src/shared/reel/estilos.css");
  expect(cssComposicion({ ancho: 1080, alto: 1920, color: "#fff", fuentes: "f", tamanoSub: 70, estiloSub: "pop" })).toMatch(/\.logo\.con-imagen\s*\{[^}]*border-radius:\s*0/);
});

test("muestra de la marca: el cierre con nombre e invitación", async () => {
  const { construirMuestraMarca } = await import("../../../src/shared/reel/composicion");
  const r = construirMuestraMarca({ marca: entrada().marca, recursos: { gsap: "g", fuentes: "f" }, formato: "9:16", modo: "vista" });
  const d = dom(r.html);
  expect(d.querySelector("#cierre h2")!.textContent).toBe("Iglesia Familia");
  expect(d.querySelector("#cierre p")!.textContent).toBe("Síguenos · Domingos 10:00 AM");
  expect(r.duracion).toBeGreaterThan(2);
});
