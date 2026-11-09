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
