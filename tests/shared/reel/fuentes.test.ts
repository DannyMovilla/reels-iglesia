// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { construirComposicion } from "../../../src/shared/reel/composicion";
import { cssFuentesElegidas, FUENTES } from "../../../src/shared/reel/fuentes";
import type { ClipSpec, Transcripcion } from "../../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3 } from "../../ayuda/plan3";

test("sin elección (clips viejos): ningún cambio de fuente", () => {
  expect(cssFuentesElegidas(undefined)).toBe("");
  expect(cssFuentesElegidas({ titulos: "figtree", subtitulos: "montserrat" })).toBe("");
});

test("Montserrat en títulos y la fuente de la iglesia en subtítulos", () => {
  const css = cssFuentesElegidas({ titulos: "montserrat", subtitulos: "iglesia" }, "recursos/fuente-iglesia.woff2");
  expect(css).toContain('@font-face { font-family: "Fuente iglesia"; src: url("recursos/fuente-iglesia.woff2")');
  expect(css).toMatch(/\.sub[^{]*\{ font-family: "Fuente iglesia", Montserrat, sans-serif !important; \}/);
  expect(css).toMatch(/\.gancho[^{]*\{ font-family: Montserrat, sans-serif !important; \}/);
});

test("si eligió la de la iglesia pero no hay archivo, se queda la de siempre", () => {
  expect(cssFuentesElegidas({ titulos: "iglesia", subtitulos: "iglesia" })).toBe("");
  expect(Object.keys(FUENTES)).toEqual(["montserrat", "figtree", "iglesia"]);
});

const muestra: Transcripcion = JSON.parse(readFileSync(join(resolve(__dirname, "../../fixtures"), "transcripcion-muestra.json"), "utf8"));
test("la composición incluye la fuente de la iglesia cuando el clip la usa", () => {
  const clip: ClipSpec = {
    id: "c", titulo: "T", gancho: "Hola", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46,
    apertura: null, palabrasClave: [], versiculos: [], puntaje: 90, razon: "", descripcion: "", hashtags: [],
    encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
    ...PLAN3, cierre: false, formatos: ["9:16"], estado: "sugerido", fuentes: { titulos: "iglesia", subtitulos: "figtree" },
  };
  const html = construirComposicion({
    clip, transcripcion: muestra, caras: null, formato: "9:16", dimensiones: { ancho: 1280, alto: 720 },
    marca: { nombre: "I", color: "#f5c542", invitacion: "", ...MARCA_PLAN3 }, fuenteVideo: "v.mp4",
    recursos: { gsap: "g.js", fuentes: "f", fuenteIglesia: "recursos/fuente-iglesia.ttf" }, modo: "render",
  }).html;
  expect(html).toContain('url("recursos/fuente-iglesia.ttf")');
  expect(html).toContain("Fuente iglesia");
});
