// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { construirComposicion } from "../../../src/shared/reel/composicion";
import { dentroDeZona, ZONAS, zonaComun } from "../../../src/shared/reel/zonas";
import type { ClipSpec, Transcripcion } from "../../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3 } from "../../ayuda/plan3";

test("la zona común es el lado más grande de cada red", () => {
  const z = zonaComun("9:16");
  for (const red of Object.keys(ZONAS) as (keyof typeof ZONAS)[]) {
    expect(z.arriba).toBeGreaterThanOrEqual(ZONAS[red]["9:16"].arriba);
    expect(z.abajo).toBeGreaterThanOrEqual(ZONAS[red]["9:16"].abajo);
  }
  expect(zonaComun("1:1")).toEqual({ arriba: 60, abajo: 60, izquierda: 60, derecha: 60 });
});

test("dentroDeZona: un elemento centrado que se sale por abajo o por arriba se mete; uno que cabe no se mueve", () => {
  const z = zonaComun("9:16");
  expect(dentroDeZona(1900, 180, "9:16")).toBe(1920 - z.abajo - 90);
  expect(dentroDeZona(50, 200, "9:16")).toBe(z.arriba + 100);
  expect(dentroDeZona(1000, 180, "9:16")).toBe(1000);
  expect(dentroDeZona(1900, 380, "9:16", "arriba")).toBe(1920 - z.abajo - 380);
});

const muestra: Transcripcion = JSON.parse(readFileSync(join(resolve(__dirname, "../../fixtures"), "transcripcion-muestra.json"), "utf8"));
const clip = (extra: Partial<ClipSpec> = {}): ClipSpec => ({
  id: "c", titulo: "T", gancho: "Tu quebranto abre el cielo", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46,
  apertura: null, palabrasClave: [], versiculos: [], puntaje: 90, razon: "", descripcion: "", hashtags: [],
  encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
  ...PLAN3, cierre: false, formatos: ["9:16"], estado: "sugerido", ...extra,
});
const comp = (c: ClipSpec) => construirComposicion({
  clip: c, transcripcion: muestra, caras: null, formato: "9:16", dimensiones: { ancho: 1280, alto: 720 },
  marca: { nombre: "I", color: "#f5c542", invitacion: "", ...MARCA_PLAN3 }, fuenteVideo: "v.mp4",
  recursos: { gsap: "g.js", fuentes: "f" }, modo: "render",
});
const topSub = (html: string) => Number(/class="clip sub pop"[^>]*style="top:([\d.]+)px"/.exec(html)![1]);

test("subtítulos muy abajo (95 %) quedan dentro de la zona común; con la altura de siempre no se mueven", () => {
  const z = zonaComun("9:16");
  expect(topSub(comp(clip()).html)).toBeCloseTo(0.74 * 1920, 1);
  const abajo = topSub(comp(clip({ subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.95 } })).html);
  expect(abajo).toBeLessThan(0.95 * 1920);
  expect(abajo).toBeLessThanOrEqual(1920 - z.abajo);
});

test("revisión I1: la tarjeta del versículo y los subtítulos «caja» grandes quedan donde estaban (9:16 y 1:1)", () => {
  const conVersiculo = clip({ versiculos: [{ ref: "Salmos 51:17", texto: "Los sacrificios de Dios son el espíritu quebrantado", en: 5, activo: true, confirmado: true }] });
  const topVers = (formato: "9:16" | "1:1", c = conVersiculo) => Number(/class="clip vers"[^>]*style="top:([\d.]+)px"/.exec(construirComposicion({
    clip: c, transcripcion: muestra, caras: null, formato, dimensiones: { ancho: 1280, alto: 720 },
    marca: { nombre: "I", color: "#f5c542", invitacion: "", ...MARCA_PLAN3 }, fuenteVideo: "v.mp4", recursos: { gsap: "g.js", fuentes: "f" }, modo: "render",
  }).html)![1]);
  expect(topVers("9:16")).toBeCloseTo(0.62 * 1920, 1);
  expect(topVers("1:1")).toBeCloseTo(0.6 * 1080, 1);
  const caja = clip({ subtitulos: { activos: true, estilo: "caja", tamano: "l", altura: 0.74 } });
  expect(Number(/class="clip sub caja"[^>]*style="top:([\d.]+)px"/.exec(comp(caja).html)![1])).toBeCloseTo(0.74 * 1920, 1);
});
