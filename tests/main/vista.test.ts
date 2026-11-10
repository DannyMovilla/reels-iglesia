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

test("sirve la librería de escenas animadas y nada más de esa carpeta", () => {
  const ESC = "C:/app/resources/escenas";
  expect(rutaRecurso("recursos/escenas/shaders.iife.js", RAIZ, undefined, ESC)).toBe(join(ESC, "shaders.iife.js"));
  expect(rutaRecurso("recursos/escenas/shaders.THIRD-PARTY-LICENSES.txt", RAIZ, undefined, ESC)).toBeNull();
  expect(rutaRecurso("recursos/escenas/../../secreto.js", RAIZ, undefined, ESC)).toBeNull();
});

test("plan 5: entrega los efectos de sonido propios y nada más de esa carpeta", () => {
  const efectos = join(RAIZ, "resources", "efectos");
  expect(rutaRecurso("recursos/efectos/whoosh.wav", RAIZ, undefined, undefined, efectos)).toBe(join(efectos, "whoosh.wav"));
  expect(rutaRecurso("recursos/efectos/pop.wav", RAIZ, undefined, undefined, efectos)).toBe(join(efectos, "pop.wav"));
  expect(rutaRecurso("recursos/efectos/../../package.json", RAIZ, undefined, undefined, efectos)).toBeNull();
  expect(rutaRecurso("recursos/efectos/otro.wav", RAIZ, undefined, undefined, efectos)).toBeNull();
  expect(rutaRecurso("recursos/efectos/whoosh.wav", RAIZ)).toBeNull();
});

test("plan 6: la vista previa entrega la fuente de la iglesia y nada más de la carpeta de la marca", () => {
  const datos = "C:/datos";
  expect(rutaRecurso("marca/fuente.ttf", RAIZ, datos)).toBe(join(datos, "marca", "fuente.ttf"));
  expect(rutaRecurso("marca/fuente.woff2", RAIZ, datos)).toBe(join(datos, "marca", "fuente.woff2"));
  expect(rutaRecurso("marca/fuente.exe", RAIZ, datos)).toBeNull();
  expect(rutaRecurso("marca/marca.json", RAIZ, datos)).toBeNull();
});

test("plan 6: la vista previa entrega solo las pinturas incluidas", () => {
  const pinturas = join(RAIZ, "resources", "pinturas");
  expect(rutaRecurso("recursos/pinturas/prodigo.jpg", RAIZ, undefined, undefined, undefined, pinturas)).toBe(join(pinturas, "prodigo.jpg"));
  expect(rutaRecurso("recursos/pinturas/otra.jpg", RAIZ, undefined, undefined, undefined, pinturas)).toBeNull();
  expect(rutaRecurso("recursos/pinturas/../../package.json", RAIZ, undefined, undefined, undefined, pinturas)).toBeNull();
});
