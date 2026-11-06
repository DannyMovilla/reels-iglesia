import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { borrarCreacion, copiarFondo, crearCreacion, guardarCreacion, leerCreacion, listarCreaciones } from "../../../src/main/ia/almacen";

let datos: string;
beforeEach(() => { datos = mkdtempSync(join(tmpdir(), "reels-ia-")); process.env.REELS_IGLESIA_DATOS = datos; });

test("crear una creación con valores por defecto y leerla igual (como al reabrir la app)", async () => {
  const c = await crearCreacion({ tipo: "versiculo", texto: "Juan 3:16" }, new Date(2026, 10, 6, 10));
  expect(c.id).toBe("2026-11-06-juan-3-16");
  expect(c.versiculo).toEqual({ ref: "", texto: "", confirmado: false });
  expect(c.fondo).toEqual({ tipo: "escena", escena: "luz" });
  expect(c.formatos).toEqual(["9:16", "4:5"]);
  expect(c.estado).toBe("borrador");
  c.versiculo = { ref: "Juan 3:16", texto: "Porque de tal manera amó Dios al mundo…", confirmado: true };
  await guardarCreacion(c);
  expect(await leerCreacion(c.id)).toEqual(c);
});

test("nombres que no se repiten y lista de la más nueva a la más vieja; un JSON roto no rompe la lista", async () => {
  const a = await crearCreacion({ tipo: "tema", texto: "Esperanza en la prueba" }, new Date(2026, 10, 5));
  const b = await crearCreacion({ tipo: "tema", texto: "Esperanza en la prueba" }, new Date(2026, 10, 5));
  expect(b.id).toBe(`${a.id}-2`);
  const c = await crearCreacion({ tipo: "versiculo", texto: "Salmo 23" }, new Date(2026, 10, 7));
  writeFileSync(join(datos, "ia", a.id, "creacion.json"), "{roto");
  expect((await listarCreaciones()).map((x) => x.id)).toEqual([c.id, b.id]);
});

test("el fondo propio se copia a la carpeta de la creación (rutas con # y espacios)", async () => {
  const c = await crearCreacion({ tipo: "versiculo", texto: "Juan 3:16" });
  const origen = join(mkdtempSync(join(tmpdir(), "fondo #1 ")), "Templo Lleno.JPG");
  writeFileSync(origen, "jpg");
  expect(await copiarFondo(c.id, origen)).toBe(join(datos, "ia", c.id, "fondo.jpg"));
  await expect(copiarFondo(c.id, join(mkdtempSync(join(tmpdir(), "x")), "notas.txt"))).rejects.toThrow(/foto o un video/);
});

test("borrar una creación", async () => {
  const c = await crearCreacion({ tipo: "versiculo", texto: "Juan 3:16" });
  await borrarCreacion(c.id);
  expect(await listarCreaciones()).toEqual([]);
});
