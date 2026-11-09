import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { crearCapitulos, promptCapitulos } from "../../../src/main/claude/capitulos";
import { crearProyecto, guardarJson, leerJson } from "../../../src/main/proyectos/almacen";
import type { Transcripcion } from "../../../src/shared/tipos";

const FIX = resolve(__dirname, "../../fixtures");
const muestra = (): Transcripcion => JSON.parse(readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8"));
const comando = `node ${join(FIX, "claude/falso-claude.mjs")}`;
let id: string;

beforeEach(async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-cap-"));
  const v = join(mkdtempSync(join(tmpdir(), "reels-v-")), "v.mp4");
  writeFileSync(v, "x");
  id = (await crearProyecto({ nombre: "Culto", video: { ruta: v, tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
  await guardarJson(id, "transcripcion.json", muestra());
  process.env.FALSO_CLAUDE_MODO = "ok";
});

test("el prompt lleva la marca, tiempos desde el inicio de la prédica y las reglas de YouTube", () => {
  const t = { ...muestra(), inicio: 100, segmentos: muestra().segmentos.map((s) => ({ ...s, s: s.s + 100, e: s.e + 100 })) };
  const p = promptCapitulos(t);
  expect(p).toContain("CAPÍTULOS DE UNA PRÉDICA");
  expect(p).toMatch(/^\[0:00\] /m);
  expect(p).toContain("al menos 3");
});

test("crea, limpia y guarda los capítulos (el que queda a menos de 10 s se quita)", async () => {
  const c = await crearCapitulos(id, { comando });
  expect(c.resumen).toMatch(/quebrantamiento/);
  expect(c.capitulos.map((x) => x.titulo)).toEqual(["Una oración profunda", "El quebrantamiento", "La gloria celestial"]);
  expect(await leerJson(id, "capitulos.json")).toEqual(c);
});

test("exportar deja capitulos.txt junto a los reels cuando hay capítulos", async () => {
  await crearCapitulos(id, { comando });
  const { escribirCapitulosTxt } = await import("../../../src/main/claude/capitulos");
  const carpeta = mkdtempSync(join(tmpdir(), "reels-exp-"));
  await escribirCapitulosTxt(id, carpeta);
  const txt = readFileSync(join(carpeta, "capitulos.txt"), "utf8");
  expect(txt).toContain("0:00 Una oración profunda");
  const otra = mkdtempSync(join(tmpdir(), "reels-exp-"));
  await guardarJson(id, "capitulos.json", null);
  await escribirCapitulosTxt(id, otra);
  expect(existsSync(join(otra, "capitulos.txt"))).toBe(false);
});
