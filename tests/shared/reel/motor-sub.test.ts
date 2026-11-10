import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { aJs } from "../../../src/shared/reel/pasos";
import { PRESETS_SUB, esPreset } from "../../../src/shared/reel/presets-sub";
import { cssEstilosSub, htmlBloque, pasosBloque } from "../../../src/shared/reel/estilos-sub";
import { bloquesSubtitulos, type Bloque } from "../../../src/shared/reel/subtitulos";
import { palabrasDe, partesDelReel } from "../../../src/shared/reel/tiempo";
import { ventanaVersiculo } from "../../../src/shared/reel/versiculo";
import type { ClipSpec, EstiloSub, Transcripcion } from "../../../src/shared/tipos";
import { PLAN3 } from "../../ayuda/plan3";

const bloque: Bloque = {
  desde: 2.1, hasta: 3.4,
  palabras: [
    { texto: "tu", desde: 2.1, hasta: 2.3, clave: false },
    { texto: "prueba", desde: 2.35, hasta: 2.8, clave: true },
    { texto: "final", desde: 2.85, hasta: 3.3, clave: false },
  ],
};
const NUEVOS = Object.keys(PRESETS_SUB) as EstiloSub[];

test("aJs escribe el paso con el formato de siempre", () => {
  expect(aJs({ metodo: "fromTo", sel: "#b0", de: { opacity: 0, scale: 0.65 }, a: { opacity: 1, ease: "power3.out", immediateRender: false }, t: 1.5 }))
    .toBe(`tl.fromTo("#b0", { opacity: 0, scale: 0.65 }, { opacity: 1, ease: "power3.out", immediateRender: false }, 1.5);`);
  expect(aJs({ metodo: "set", sel: "#b0w1 .fondo", a: { color: "#fff" }, t: 2 })).toBe(`tl.set("#b0w1 .fondo", { color: "#fff" }, 2);`);
});

test("hay 8 estilos nuevos y son presets", () => {
  expect(NUEVOS.sort()).toEqual(["brillo", "cajamarca", "dostonos", "elegante", "rebote", "subrayado", "una", "viral"]);
  expect(NUEVOS.every(esPreset)).toBe(true);
  expect(esPreset("pop")).toBe(false);
});

describe.each(NUEVOS)("preset %s", (e) => {
  test("una palabra con id por cada palabra, pasos del bloque y su CSS", () => {
    const html = htmlBloque(e, bloque, 3);
    for (const j of [0, 1, 2]) expect(html).toContain(`id="b3w${j}"`);
    const pasos = pasosBloque(e, bloque, 3, "#f5c542");
    expect(pasos.length).toBeGreaterThan(0);
    expect(pasos.every((p) => p.sel.startsWith("#b3"))).toBe(true);
    expect(cssEstilosSub(70)).toContain(`.sub.${e}`);
  });
});

test("viral marca la palabra dicha en amarillo", () => {
  expect(pasosBloque("viral", bloque, 0, "#3366ff").map(aJs).join("\n")).toContain("#FFE14D");
});

test("caja de marca usa el color de la iglesia y texto oscuro si es claro", () => {
  const claro = pasosBloque("cajamarca", bloque, 0, "#f5c542").map(aJs).join("\n");
  expect(claro).toContain("#f5c542");
  expect(claro).toContain("#111111");
  expect(pasosBloque("cajamarca", bloque, 0, "#202060").map(aJs).join("\n")).not.toContain("#111111");
});

test("elegante no pasa a mayúsculas", () => {
  expect(htmlBloque("elegante", bloque, 0)).toContain(">prueba<");
  expect(htmlBloque("viral", bloque, 0)).toContain("PRUEBA");
});

test.each(["dostonos", "brillo"] as const)("%s solo anima las palabras clave", (e) => {
  const porPalabra = pasosBloque(e, bloque, 0, "#f5c542").filter((p) => /w\d/.test(p.sel));
  expect(porPalabra.length).toBeGreaterThan(0);
  expect(porPalabra.every((p) => p.sel.startsWith("#b0w1"))).toBe(true);
});

const muestra: Transcripcion = JSON.parse(readFileSync(join(resolve(__dirname, "../../fixtures"), "transcripcion-muestra.json"), "utf8"));
const clip = (estilo: EstiloSub, versiculos: ClipSpec["versiculos"] = []): ClipSpec => ({
  id: "c", titulo: "t", gancho: "", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46, apertura: null,
  palabrasClave: [], versiculos, puntaje: 90, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo, tamano: "m", altura: 0.74 }, ...PLAN3, cierre: false, formatos: ["9:16"], estado: "sugerido",
});

test("límites de palabras y letras por preset", () => {
  const palabras = palabrasDe(muestra);
  const una = bloquesSubtitulos(clip("una"), palabras, partesDelReel(clip("una"), palabras));
  expect(una.length).toBeGreaterThan(5);
  expect(una.every((b) => b.palabras.length === 1)).toBe(true);
  const viral = bloquesSubtitulos(clip("viral"), palabras, partesDelReel(clip("viral"), palabras));
  for (const b of viral) {
    expect(b.palabras.length).toBeLessThanOrEqual(3);
    if (b.palabras.length > 1) expect(b.palabras.reduce((a, p) => a + p.texto.length + 1, 0) - 1).toBeLessThanOrEqual(18);
  }
});

test("rebote respeta la regla del versículo", () => {
  const palabras = palabrasDe(muestra);
  const c = clip("rebote", [{ ref: "Salmos 51:17", texto: "x", en: 10, activo: true, confirmado: true }]);
  const partes = partesDelReel(c, palabras);
  const v = ventanaVersiculo(c.versiculos[0], partes.find((p) => p.tipo === "clip")!)!;
  expect(v).not.toBeNull();
  expect(bloquesSubtitulos(c, palabras, partes).some((b) => b.desde >= v.desde && b.desde < v.hasta)).toBe(false);
});
