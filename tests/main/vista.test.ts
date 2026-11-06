import { join } from "node:path";
import { expect, test } from "vitest";
import { composicionRegistrada, registrarComposicion, rutaRecurso } from "../../src/main/vista";

const RAIZ = "C:/app";

test("registrar una composición devuelve su URL y la guarda", () => {
  expect(registrarComposicion("clip-1-9x16", "<html>a</html>")).toBe("reels-comp://clip-1-9x16/index.html");
  expect(composicionRegistrada("clip-1-9x16")).toBe("<html>a</html>");
});

test("solo entrega GSAP, el runtime de HyperFrames y las fuentes de @fontsource", () => {
  expect(rutaRecurso("recursos/gsap.min.js", RAIZ)).toBe(join(RAIZ, "node_modules", "gsap", "dist", "gsap.min.js"));
  expect(rutaRecurso("recursos/hyperframe.runtime.iife.js", RAIZ)).toBe(join(RAIZ, "node_modules", "@hyperframes", "core", "dist", "hyperframe.runtime.iife.js"));
  expect(rutaRecurso("recursos/fuentes/figtree/files/figtree-latin-800-normal.woff2", RAIZ))
    .toBe(join(RAIZ, "node_modules", "@fontsource", "figtree", "files", "figtree-latin-800-normal.woff2"));
});

test("no deja salir de las carpetas permitidas", () => {
  expect(rutaRecurso("recursos/fuentes/../../../package.json", RAIZ)).toBeNull();
  expect(rutaRecurso("recursos/otra-cosa.js", RAIZ)).toBeNull();
  expect(rutaRecurso("../secreto.txt", RAIZ)).toBeNull();
});

test("sirve el logo de la marca y nada más de la carpeta de datos", () => {
  const DATOS = "C:/datos";
  expect(rutaRecurso("marca/logo.png", RAIZ, DATOS)).toBe(join(DATOS, "marca", "logo.png"));
  expect(rutaRecurso("marca/logo.svg", RAIZ, DATOS)).toBe(join(DATOS, "marca", "logo.svg"));
  expect(rutaRecurso("marca/otro.png", RAIZ, DATOS)).toBeNull();
  expect(rutaRecurso("marca/../marca.json", RAIZ, DATOS)).toBeNull();
  expect(rutaRecurso("marca/logo.png", RAIZ)).toBeNull();
});
