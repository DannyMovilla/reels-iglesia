import { join } from "node:path";
import { expect, test } from "vitest";
import { raizApp, raizRecursos } from "../../src/main/rutas";

test("en desarrollo todo sale de la carpeta del repositorio", () => {
  const raiz = raizApp({ empaquetada: false, recursos: "C:/X" });
  expect(raizRecursos({ empaquetada: false, recursos: "C:/X" })).toBe(raiz);
  expect(raiz.endsWith("reels-iglesia")).toBe(true);
});

test("instalada: node_modules desde app.asar.unpacked; python y modelos desde resources", () => {
  const recursos = "C:/Program Files/Reels Iglesia/resources";
  expect(raizApp({ empaquetada: true, recursos })).toBe(join(recursos, "app.asar.unpacked"));
  expect(raizRecursos({ empaquetada: true, recursos })).toBe(recursos);
});
