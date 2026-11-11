import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { liberarEspacio, liberarTodo, limpiarTmpViejos, tamanoCarpeta } from "../../../src/main/datos/espacio";
import { crearProyecto } from "../../../src/main/proyectos/almacen";
import { carpetaProyecto } from "../../../src/main/rutas";
import { formatoTamano } from "../../../src/shared/tamano";

let id: string;
let video: string;
const libre = { ocupado: () => false };

beforeEach(async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-espacio-"));
  video = join(mkdtempSync(join(tmpdir(), "reels-v-")), "culto.mp4");
  writeFileSync(video, "x");
  id = (await crearProyecto({ nombre: "Culto", video: { ruta: video, tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 50 } })).id;
  const c = carpetaProyecto(id);
  mkdirSync(join(c, "tmp", "t1"), { recursive: true });
  writeFileSync(join(c, "tmp", "t1", "render.html"), "a".repeat(1000));
  writeFileSync(join(c, "voz.m4a"), "v".repeat(2000));
  writeFileSync(join(c, "voz-podcast.m4a"), "v".repeat(3000));
  mkdirSync(join(c, "exportados"), { recursive: true });
  writeFileSync(join(c, "exportados", "fe-9x16.mp4"), "m".repeat(500));
});

test("tamanoCarpeta suma los archivos anidados; una carpeta que no existe pesa 0", async () => {
  expect(await tamanoCarpeta(join(carpetaProyecto(id), "tmp"))).toBe(1000);
  expect(await tamanoCarpeta(join(carpetaProyecto(id), "no-existe"))).toBe(0);
});

test("liberar borra tmp/ y las voces de otros niveles si el video original está; voz.m4a (Limpia) se queda", async () => {
  const r = await liberarEspacio(id, libre);
  expect(r).toEqual({ liberado: 4000, saltada: false });
  const c = carpetaProyecto(id);
  expect(existsSync(join(c, "tmp"))).toBe(false);
  // La vista previa del editor usa voz.m4a sin volver a crearla: borrarla deja las prédicas mudas.
  expect(existsSync(join(c, "voz.m4a"))).toBe(true);
  expect(existsSync(join(c, "voz-podcast.m4a"))).toBe(false);
  expect(existsSync(join(c, "exportados", "fe-9x16.mp4"))).toBe(true);
});

test("sin el video original, las voces se conservan (no se podrían rehacer)", async () => {
  rmSync(video);
  const r = await liberarEspacio(id, libre);
  expect(r.liberado).toBe(1000);
  expect(existsSync(join(carpetaProyecto(id), "voz.m4a"))).toBe(true);
});

test("una prédica trabajando se salta y no se toca (Review Focus 5)", async () => {
  const r = await liberarEspacio(id, { ocupado: (x) => x === id });
  expect(r).toEqual({ liberado: 0, saltada: true });
  expect(existsSync(join(carpetaProyecto(id), "tmp", "t1", "render.html"))).toBe(true);
  expect(await liberarTodo({ ocupado: () => true })).toEqual({ liberado: 0, saltadas: 1 });
});

test("al abrir, se borra lo de tmp/ de más de 7 días", async () => {
  const c = carpetaProyecto(id);
  const viejo = join(c, "tmp", "viejo.html");
  writeFileSync(viejo, "x");
  const ahora = Date.now();
  utimesSync(viejo, new Date(ahora - 8 * 864e5), new Date(ahora - 8 * 864e5));
  utimesSync(join(c, "tmp", "t1"), new Date(ahora - 2 * 864e5), new Date(ahora - 2 * 864e5));
  expect(await limpiarTmpViejos(7, ahora, () => false)).toBe(1);
  expect(existsSync(viejo)).toBe(false);
  expect(existsSync(join(c, "tmp", "t1", "render.html"))).toBe(true);
});

test("tamaños en palabras, con coma decimal", () => {
  expect(formatoTamano(1_234_567_890)).toBe("1,2 GB");
  expect(formatoTamano(12_400_000)).toBe("12,4 MB");
  expect(formatoTamano(820_000)).toBe("820 KB");
  expect(formatoTamano(0)).toBe("0 KB");
  expect(formatoTamano(820_000_000)).toBe("820 MB");
  expect(formatoTamano(2_000_000_000)).toBe("2 GB");
});
