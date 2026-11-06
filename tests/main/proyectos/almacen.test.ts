import { mkdtempSync, renameSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { crearProyecto, guardarJson, leerJson, leerProyecto, listarProyectos } from "../../../src/main/proyectos/almacen";
import { validarRango } from "../../../src/shared/validar";
import type { VideoOrigen } from "../../../src/shared/tipos";

let datos: string;
let video: VideoOrigen;
const DOS_NOV = new Date(2026, 10, 2, 10, 0, 0);

beforeEach(() => {
  datos = mkdtempSync(join(tmpdir(), "reels-datos-"));
  process.env.REELS_IGLESIA_DATOS = datos;
  const ruta = join(mkdtempSync(join(tmpdir(), "reels-video-")), "culto (1280p) ñ.mp4");
  writeFileSync(ruta, Buffer.alloc(1024, 1));
  const st = statSync(ruta);
  video = { ruta, tamano: st.size, modificado: st.mtimeMs, duracion: 100 };
});

test("crea la carpeta del proyecto con estado nuevo y pasos pendientes", async () => {
  const p = await crearProyecto({ nombre: "Culto dominical", video, rango: { inicio: 0, fin: 60 } }, DOS_NOV);
  expect(p.id).toBe("2026-11-02-culto-dominical");
  const carpeta = join(datos, "proyectos", "2026-11-02-culto-dominical");
  expect(existsSync(join(carpeta, "proyecto.json"))).toBe(true);
  expect(p.estado).toBe("nuevo");
  expect(p.pasos.transcripcion.estado).toBe("pendiente");
  expect(p.pasos.caras.estado).toBe("pendiente");
  expect(p.pasos.analisis.estado).toBe("pendiente");
});

test("un segundo proyecto con el mismo nombre y fecha recibe sufijo -2", async () => {
  await crearProyecto({ nombre: "Culto dominical", video, rango: { inicio: 0, fin: 60 } }, DOS_NOV);
  const p2 = await crearProyecto({ nombre: "Culto dominical", video, rango: { inicio: 0, fin: 60 } }, DOS_NOV);
  expect(p2.id).toBe("2026-11-02-culto-dominical-2");
});

test("validarRango da mensajes en español", () => {
  expect(validarRango(10, 5, 100)).toBe("El fin de la prédica debe ser después del inicio.");
  expect(validarRango(0, 120, 100)).toBe("El fin de la prédica pasa la duración del video (1:40).");
  expect(validarRango(0, 60, 100)).toBeNull();
});

test("crearProyecto con rango inválido rechaza y no crea carpeta", async () => {
  await expect(crearProyecto({ nombre: "Malo", video, rango: { inicio: 50, fin: 40 } }, DOS_NOV))
    .rejects.toThrow("El fin de la prédica debe ser después del inicio.");
  expect(existsSync(join(datos, "proyectos")) ? readdirSync(join(datos, "proyectos")) : []).toEqual([]);
});

test("si el video original se movió, el proyecto abre y conserva sus clips", async () => {
  const p = await crearProyecto({ nombre: "Culto", video, rango: { inicio: 0, fin: 60 } }, DOS_NOV);
  await guardarJson(p.id, "clips.json", [{ id: "c1" }]);
  renameSync(video.ruta, video.ruta + ".movido");
  const leido = await leerProyecto(p.id);
  expect(leido.videoDisponible).toBe(false);
  expect(await leerJson(p.id, "clips.json")).toEqual([{ id: "c1" }]);
});

test("listarProyectos devuelve el más nuevo primero", async () => {
  await crearProyecto({ nombre: "Primero", video, rango: { inicio: 0, fin: 60 } }, new Date(2026, 9, 1));
  await crearProyecto({ nombre: "Segundo", video, rango: { inicio: 0, fin: 60 } }, DOS_NOV);
  const lista = await listarProyectos();
  expect(lista.map((p) => p.nombre)).toEqual(["Segundo", "Primero"]);
});

test("guardarClip reemplaza solo el clip con ese id", async () => {
  const { guardarClip } = await import("../../../src/main/proyectos/almacen");
  const p = await crearProyecto({ nombre: "Culto", video, rango: { inicio: 0, fin: 60 } }, DOS_NOV);
  await guardarJson(p.id, "clips.json", [{ id: "a", gancho: "A" }, { id: "b", gancho: "B" }]);
  await guardarClip(p.id, { id: "b", gancho: "B2" } as never);
  await guardarClip(p.id, { id: "zzz", gancho: "X" } as never);
  expect(await leerJson(p.id, "clips.json")).toEqual([{ id: "a", gancho: "A" }, { id: "b", gancho: "B2" }]);
});
