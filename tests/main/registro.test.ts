import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { configurarRegistro, leerUltimas, limpiarRegistrosViejos, registrar } from "../../src/main/registro";
import { carpetaRegistros } from "../../src/main/rutas";

let carpeta: string;
let ahora = new Date("2026-11-10T21:04:05.123Z");
beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), "reels-registro-"));
  ahora = new Date("2026-11-10T21:04:05.123Z");
  configurarRegistro({ carpeta, ahora: () => ahora });
});
const hoy = () => readFileSync(join(carpeta, "reels-2026-11-10.log"), "utf8");

test("una línea por evento con hora, nivel, origen y mensaje", () => {
  registrar("error", "ipc", "proyectos:borrar: No hay transcripción.");
  expect(hoy()).toBe("2026-11-10T21:04:05.123Z error ipc proyectos:borrar: No hay transcripción.\n");
});

test("un mensaje largo y con saltos de línea queda en una línea de 300 caracteres como mucho", () => {
  registrar("aviso", "claude", `respuesta inválida:\n${"x".repeat(1000)}`);
  const linea = hoy().trimEnd();
  expect(linea.split("\n")).toHaveLength(1);
  const mensaje = linea.slice("2026-11-10T21:04:05.123Z aviso claude ".length);
  expect(mensaje.length).toBeLessThanOrEqual(300);
  expect(mensaje.endsWith("…")).toBe(true);
});

test("con el tope alcanzado escribe «registro lleno» una sola vez y después nada más ese día", () => {
  configurarRegistro({ carpeta, ahora: () => ahora, tope: 200 });
  for (let i = 0; i < 10; i++) registrar("info", "prueba", `evento número ${i} con algo de texto`);
  const lineas = hoy().trimEnd().split("\n");
  expect(lineas.filter((l) => l.includes("registro lleno"))).toHaveLength(1);
  expect(lineas.at(-1)).toContain("registro lleno");
  ahora = new Date("2026-11-11T08:00:00.000Z");
  registrar("info", "prueba", "otro día");
  expect(readFileSync(join(carpeta, "reels-2026-11-11.log"), "utf8")).toContain("otro día");
});

test("borra los registros de más de 7 días", () => {
  writeFileSync(join(carpeta, "reels-2026-11-01.log"), "viejo\n");
  writeFileSync(join(carpeta, "reels-2026-11-04.log"), "reciente\n");
  writeFileSync(join(carpeta, "otra-cosa.txt"), "no es un registro\n");
  limpiarRegistrosViejos(7);
  expect(readdirSync(carpeta).sort()).toEqual(["otra-cosa.txt", "reels-2026-11-04.log"]);
});

test("leerUltimas junta ayer y hoy", () => {
  ahora = new Date("2026-11-09T10:00:00.000Z");
  registrar("info", "a", "uno");
  registrar("info", "a", "dos");
  ahora = new Date("2026-11-10T10:00:00.000Z");
  registrar("info", "a", "tres");
  expect(leerUltimas(3).map((l) => l.split(" ").at(-1))).toEqual(["uno", "dos", "tres"]);
  expect(leerUltimas(2).map((l) => l.split(" ").at(-1))).toEqual(["dos", "tres"]);
});

test("si la carpeta no se puede crear, registrar no lanza (Review Focus 1)", () => {
  const archivo = join(carpeta, "soy-un-archivo");
  writeFileSync(archivo, "x");
  configurarRegistro({ carpeta: join(archivo, "registros"), ahora: () => ahora });
  expect(() => registrar("error", "x", "y")).not.toThrow();
  expect(() => leerUltimas(5)).not.toThrow();
  expect(() => limpiarRegistrosViejos()).not.toThrow();
});

test("con REELS_IGLESIA_DATOS los registros van en esa carpeta", () => {
  process.env.REELS_IGLESIA_DATOS = carpeta;
  expect(carpetaRegistros()).toBe(join(carpeta, "registros"));
  expect(existsSync(carpeta)).toBe(true);
});
