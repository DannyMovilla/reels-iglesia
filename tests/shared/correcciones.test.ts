import { expect, test } from "vitest";
import { aplicarCorrecciones } from "../../src/shared/correcciones";
import type { Transcripcion } from "../../src/shared/tipos";

const t: Transcripcion = {
  formato: "pulpito-transcripcion/1", inicio: 0, fin: 10, modelo: "m", dispositivo: "cpu",
  segmentos: [
    { s: 0, e: 4, t: "Mi dios, la diosa y Dios.", w: [[0, 0.5, "Mi"], [0.6, 1, "dios,"], [1.1, 1.5, "la"], [1.6, 2, "diosa"], [2.1, 2.3, "y"], [2.4, 3, "Dios."]] },
    { s: 5, e: 7, t: "Pablo escribio", w: [[5, 5.5, "Pablo"], [5.6, 7, "escribio"]] },
  ],
};

test("en toda la prédica: conserva los signos de cada aparición y no toca palabras parecidas", () => {
  const r = aplicarCorrecciones(t, [{ de: "dios,", a: "Dios," }]);
  expect(r.segmentos[0].w.map((w) => w[2])).toEqual(["Mi", "Dios,", "la", "diosa", "y", "Dios."]);
  expect(r.segmentos[0].t).toBe("Mi Dios, la diosa y Dios.");
});

test("solo esa aparición (en = segundo de la palabra)", () => {
  const r = aplicarCorrecciones(t, [{ de: "escribio", a: "escribió", en: 5.6 }, { de: "dios", a: "Señor", en: 2.4 }]);
  expect(r.segmentos[1].t).toBe("Pablo escribió");
  expect(r.segmentos[0].w.map((w) => w[2])).toEqual(["Mi", "dios,", "la", "diosa", "y", "Señor."]);
});

test("varias palabras en el reemplazo y el original queda sin tocar", () => {
  const r = aplicarCorrecciones(t, [{ de: "Pablo", a: "el apóstol Pablo" }]);
  expect(r.segmentos[1].t).toBe("el apóstol Pablo escribio");
  expect(t.segmentos[1].w[0][2]).toBe("Pablo");
});

test("sin correcciones devuelve la misma transcripción", () => {
  expect(aplicarCorrecciones(t, [])).toBe(t);
});

test("revisión I4: «él» → «Él» no cambia el artículo «el» (las tildes y la ñ distinguen palabras)", () => {
  const t2: Transcripcion = { ...t, segmentos: [{ s: 0, e: 3, t: "él dijo el pan del año y ano", w: [[0, 0.2, "él"], [0.3, 0.5, "dijo"], [0.6, 0.7, "el"], [0.8, 1, "pan"], [1.1, 1.3, "del"], [1.4, 1.6, "año"], [1.7, 1.8, "y"], [1.9, 2, "ano"]] }] };
  const r = aplicarCorrecciones(t2, [{ de: "él", a: "Él" }, { de: "año", a: "AÑO" }]);
  expect(r.segmentos[0].w.map((x) => x[2])).toEqual(["Él", "dijo", "el", "pan", "del", "AÑO", "y", "ano"]);
});

test("plan 6: si la corrección trae signos, cambia también los de esa palabra", () => {
  const r = aplicarCorrecciones(t, [{ de: "dios,", a: "Dios.", en: 0.6 }]);
  expect(r.segmentos[0].w[1][2]).toBe("Dios.");
  const sin = aplicarCorrecciones(t, [{ de: "dios,", a: "Dios", en: 0.6 }]);
  expect(sin.segmentos[0].w[1][2]).toBe("Dios,");
});
