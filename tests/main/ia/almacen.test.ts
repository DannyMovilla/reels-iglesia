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

test("los reels exportados de «Con IA» aparecen en Exportados con su portada", async () => {
  const { listarExportadosIa, carpetaCreacion } = await import("../../../src/main/ia/almacen");
  const c = await crearCreacion({ tipo: "versiculo", texto: "Juan 8:12" });
  await guardarCreacion({ ...c, versiculo: { ref: "Juan 8:12", texto: "t", confirmado: true } });
  writeFileSync(join(carpetaCreacion(c.id), "exportados", "juan-8-12-9x16.mp4"), "x");
  writeFileSync(join(carpetaCreacion(c.id), "exportados", "juan-8-12-9x16-portada.jpg"), "x");
  expect(await listarExportadosIa()).toEqual([{ proyectoId: `ia:${c.id}`, nombre: "Con IA · Juan 8:12", archivos: [{ nombre: "juan-8-12-9x16.mp4", tamano: 1, portada: "juan-8-12-9x16-portada.jpg" }] }]);
});

test("el servidor de medios encuentra los archivos de «Con IA»", async () => {
  const { resolverMedio } = await import("../../../src/main/ipc");
  const c = await crearCreacion({ tipo: "versiculo", texto: "Juan 8:12" });
  expect(await resolverMedio("exportado", `ia:${c.id}/juan-9x16.mp4`)).toBe(join(datos, "ia", c.id, "exportados", "juan-9x16.mp4"));
  expect(await resolverMedio("fondo-ia", `${c.id}/fondo.jpg`)).toBe(join(datos, "ia", c.id, "fondo.jpg"));
  expect(await resolverMedio("fondo-ia", `${c.id}/../x`)).toBeNull();
});

test("revisión: un id con «..» o barras no sale de la carpeta de «Con IA»", async () => {
  const { carpetaIa } = await import("../../../src/main/ia/almacen");
  await crearCreacion({ tipo: "versiculo", texto: "Juan 3:16" });
  await expect(borrarCreacion("..")).rejects.toThrow();
  await expect(leerCreacion("../x")).rejects.toThrow();
  expect((await listarCreaciones()).length).toBe(1);
  expect(carpetaIa()).toContain("ia");
});
