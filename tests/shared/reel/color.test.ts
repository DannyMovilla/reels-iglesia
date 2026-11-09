// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { IDENTIDAD, MATRIZ_LOOK, matrizColor } from "../../../src/shared/reel/color";
import { construirComposicion } from "../../../src/shared/reel/composicion";
import type { ClipSpec, Transcripcion } from "../../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3 } from "../../ayuda/plan3";

test("«natural» con intensidad 1 es la identidad; intensidad 0,5 queda a mitad de camino", () => {
  expect(matrizColor("natural", 1)).toEqual(IDENTIDAD);
  const mitad = matrizColor("calido", 0.5);
  mitad.forEach((v, i) => expect(v).toBeCloseTo((IDENTIDAD[i] + MATRIZ_LOOK.calido[i]) / 2, 4));
  expect(matrizColor("calido", 0)).toEqual(IDENTIDAD);
});

test("el balance multiplica cada canal", () => {
  const m = matrizColor("natural", 1, [0.9, 1, 1.2]);
  expect(m.slice(0, 5)).toEqual([0.9, 0, 0, 0, 0]);
  expect(m.slice(10, 15)).toEqual([0, 0, 1.2, 0, 0]);
});

const muestra: Transcripcion = JSON.parse(readFileSync(join(resolve(__dirname, "../../fixtures"), "transcripcion-muestra.json"), "utf8"));
const clip = (extra: Partial<ClipSpec> = {}): ClipSpec => ({
  id: "c", titulo: "T", gancho: "", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46,
  apertura: { activa: true, inicio: 39.02, fin: 44.8, frase: "x" }, palabrasClave: [], versiculos: [], puntaje: 90, razon: "", descripcion: "", hashtags: [],
  encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
  ...PLAN3, cierre: false, formatos: ["9:16"], estado: "sugerido", ...extra,
});
const html = (c: ClipSpec) => construirComposicion({
  clip: c, transcripcion: muestra, caras: null, formato: "9:16", dimensiones: { ancho: 1280, alto: 720 },
  marca: { nombre: "I", color: "#f5c542", invitacion: "", ...MARCA_PLAN3 }, fuenteVideo: "v.mp4",
  recursos: { gsap: "g.js", fuentes: "f" }, modo: "render",
}).html;

test("sin color (clip viejo) o natural sin balance: ningún filtro", () => {
  expect(html(clip())).not.toContain("feColorMatrix");
  expect(html(clip({ color: { look: "natural", intensidad: 1 } }))).not.toContain("feColorMatrix");
});

test("con un look: un filtro SVG y todos los videos lo usan (la apertura sigue en blanco y negro)", () => {
  const h = html(clip({ color: { look: "cine", intensidad: 0.8 } }));
  const d = new DOMParser().parseFromString(h, "text/html");
  const m = d.querySelector("filter#color feColorMatrix")!;
  expect(m.getAttribute("values")!.split(" ").map(Number)).toEqual(matrizColor("cine", 0.8));
  const videos = [...d.querySelectorAll("video")];
  for (const v of videos) expect(v.getAttribute("style")).toContain("url(#color)");
  expect(videos.some((v) => v.getAttribute("style")!.includes("grayscale(1)"))).toBe(true);
});
