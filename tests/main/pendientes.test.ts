import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { traducirErrorRender } from "../../src/main/exportar/render";
import { crearProyecto, guardarClip, guardarJson, leerJson, leerProyecto, reubicarVideo } from "../../src/main/proyectos/almacen";
import { cacheSinErrores } from "../../src/main/util/cache";
import { composicionRegistrada, registrarComposicion } from "../../src/main/vista";
import { moverVersiculos } from "../../src/shared/clip";
import { leerTiempo } from "../../src/shared/validar";
import type { ClipSpec } from "../../src/shared/tipos";

beforeEach(() => { process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-pend-")); });
const archivo = (nombre: string, bytes: number) => { const r = join(mkdtempSync(join(tmpdir(), "v-")), nombre); writeFileSync(r, Buffer.alloc(bytes, 1)); return r; };

test("1. ubicar el video movido: acepta el mismo archivo en otra ruta y rechaza otro distinto", async () => {
  const original = archivo("culto.mp4", 1000);
  const p = await crearProyecto({ nombre: "Culto", video: { ruta: original, tamano: 1000, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 90 } });
  const movido = archivo("culto (copia).mp4", 1000);
  await reubicarVideo(p.id, movido);
  const leido = await leerProyecto(p.id);
  expect(leido.video.ruta).toBe(movido);
  expect(leido.videoDisponible).toBe(true);
  await expect(reubicarVideo(p.id, archivo("otro.mp4", 999))).rejects.toThrow(/no es el mismo video/);
});

test("2. un versículo cuyo momento quedó fuera del nuevo corte se apaga y se marca", () => {
  const vs: ClipSpec["versiculos"] = [
    { ref: "Juan 3:16", texto: "t", en: 2, activo: true, confirmado: true },
    { ref: "Romanos 8:28", texto: "t", en: 20, activo: true, confirmado: true },
  ];
  const r = moverVersiculos(vs, 30, 40, 35, 60); // el clip [30, 60] pasa a [35, 60]
  expect(r[0]).toMatchObject({ activo: false, fuera: true });
  expect(r[1]).toMatchObject({ en: 15, activo: true });
  expect(r[1].fuera).toBeFalsy();
});

test("3. errores del render en español, con el detalle aparte", () => {
  expect(traducirErrorRender("Error: spawn ffmpeg ENOENT")).toMatch(/^Falta FFmpeg/);
  expect(traducirErrorRender("HyperFrames requires Node.js >= 22 (current: 20.18.1)")).toMatch(/actualizar/);
  expect(traducirErrorRender("ENOSPC: no space left on device, write")).toMatch(/espacio/);
  expect(traducirErrorRender("Windows refused to start the browser (error 5, spawn UNKNOWN)")).toMatch(/navegador del render/);
  expect(traducirErrorRender("algo raro\nlínea final")).toBe("No se pudo exportar el reel.\n\nDetalle: línea final");
});

test("4. una lectura fallida no queda guardada en la caché", async () => {
  let n = 0;
  const leer = cacheSinErrores(async (_k: string) => { n++; if (n === 1) throw new Error("ffprobe falló"); return n; });
  await expect(leer("a")).rejects.toThrow();
  expect(await leer("a")).toBe(2);
  expect(await leer("a")).toBe(2);
});

test("5. la vista previa conserva solo las últimas composiciones", () => {
  for (let i = 0; i < 12; i++) registrarComposicion(`vista-x${i}`, `<html>${i}</html>`);
  expect(composicionRegistrada("vista-x0")).toBeUndefined();
  expect(composicionRegistrada("vista-x11")).toBe("<html>11</html>");
});

test("6. una edición que llega tarde no borra el estado «exportado»", async () => {
  const p = await crearProyecto({ nombre: "Culto", video: { ruta: "C:/v.mp4", tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 90 } });
  await guardarJson(p.id, "clips.json", [{ id: "c", estado: "exportado", gancho: "A" }]);
  await guardarClip(p.id, { id: "c", estado: "editado", gancho: "B" } as never);
  expect(await leerJson(p.id, "clips.json")).toEqual([{ id: "c", estado: "exportado", gancho: "B" }]);
});

test("8. el campo de tiempo rechaza minutos o segundos de 60 o más", () => {
  expect(leerTiempo("1:75:00")).toBeNaN();
  expect(leerTiempo("1:44:60")).toBeNaN();
  expect(leerTiempo("90:00")).toBe(5400); // minutos sueltos sí pueden pasar de 59
  expect(leerTiempo("1:44:44")).toBe(6284);
});

test("el servidor de medios entrega la voz limpia y los pads de la caché (solo nombres simples)", async () => {
  const { resolverMedio } = await import("../../src/main/ipc");
  const { carpetaProyecto, carpetaDatos } = await import("../../src/main/rutas");
  expect(await resolverMedio("voz", "p1")).toBe(join(carpetaProyecto("p1"), "voz.m4a"));
  expect(await resolverMedio("voz", "../x")).toBeNull();
  expect(await resolverMedio("cache", "pad-esperanza-Sol.wav")).toBe(join(carpetaDatos(), "cache", "pad-esperanza-Sol.wav"));
  expect(await resolverMedio("cache", "../marca.json")).toBeNull();
  // plan 9: la fuente de la iglesia (para la galería), solo con su nombre fijo.
  expect(await resolverMedio("marca", "fuente.woff2")).toBe(join(carpetaDatos(), "marca", "fuente.woff2"));
  expect(await resolverMedio("marca", "../fuente.ttf")).toBeNull();
  expect(await resolverMedio("marca", "marca.json")).toBeNull();
});
