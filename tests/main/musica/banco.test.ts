import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { agregarPista, cambiarAnimo, listarPistas, musicaParaClip, type DepsMusica } from "../../../src/main/musica/banco";
import { crearProyecto } from "../../../src/main/proyectos/almacen";
import { carpetaProyecto } from "../../../src/main/rutas";
import { completarClip, ESTILO_POR_DEFECTO } from "../../../src/shared/clip";
import type { ClipSpec, Proyecto } from "../../../src/shared/tipos";

let datos: string;
let pads: { duracion: number; tonalidad: string; animo: string; destino: string }[];
const deps: DepsMusica = {
  duracion: async () => 95,
  generarPad: async (duracion, tonalidad, animo, _semilla, destino) => { pads.push({ duracion, tonalidad, animo, destino }); writeFileSync(destino, "wav"); },
};
const archivo = (nombre: string) => { const r = join(mkdtempSync(join(tmpdir(), "pista-")), nombre); writeFileSync(r, "mp3"); return r; };
const clip = (musica: Partial<ClipSpec["musica"]>): ClipSpec =>
  completarClip({ id: "c1", titulo: "T", categoria: "Esperanza", descripcion: "", hashtags: [], musica: { modo: "auto", pista: null, volumen: 0.12, ...musica } }, ESTILO_POR_DEFECTO);
let proyecto: Proyecto;

beforeEach(async () => {
  datos = mkdtempSync(join(tmpdir(), "reels-musica-"));
  process.env.REELS_IGLESIA_DATOS = datos;
  pads = [];
  proyecto = await crearProyecto({ nombre: "Culto", video: { ruta: "C:/v.mp4", tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 90 } });
});

test("agregar una pista la copia a la carpeta de música con su ánimo, y se puede cambiar", async () => {
  const p = await agregarPista(archivo("Alabanza #1.mp3"), deps);
  expect(p).toMatchObject({ titulo: "Alabanza #1", animo: "reflexivo", duracion: 95, propia: true });
  expect(existsSync(join(datos, "musica", p.id))).toBe(true);
  await cambiarAnimo(p.id, "victoria");
  expect((await listarPistas(deps))[0].animo).toBe("victoria");
  const otra = await agregarPista(archivo("Alabanza #1.mp3"), deps); // mismo nombre: no pisa la anterior
  expect(otra.id).not.toBe(p.id);
  expect(await listarPistas(deps)).toHaveLength(2);
});

test("solo acepta audio", async () => {
  await expect(agregarPista(archivo("notas.txt"), deps)).rejects.toThrow(/MP3, WAV, M4A, OGG o FLAC/);
});

test("modo auto: una pista del ánimo del clip, sin repetir la del reel anterior", async () => {
  const a = await agregarPista(archivo("a.mp3"), deps);
  const b = await agregarPista(archivo("b.mp3"), deps);
  await cambiarAnimo(a.id, "esperanza");
  await cambiarAnimo(b.id, "esperanza");
  const primera = await musicaParaClip(clip({}), proyecto, 40, deps);
  const segunda = await musicaParaClip(clip({}), proyecto, 40, deps);
  expect([primera, segunda].sort()).toEqual([join(datos, "musica", a.id), join(datos, "musica", b.id)].sort());
  expect(JSON.parse(readFileSync(join(carpetaProyecto(proyecto.id), "musica-usada.json"), "utf8"))).toHaveLength(2);
});

test("modo auto sin pistas de ese ánimo, o modo pad: genera un pad de la duración del reel", async () => {
  const r = await musicaParaClip(clip({ tonalidad: "Sol" }), proyecto, 41.2, deps);
  expect(pads).toEqual([{ duracion: 42, tonalidad: "Sol", animo: "esperanza", destino: r }]);
  expect(r!.startsWith(join(carpetaProyecto(proyecto.id), "tmp"))).toBe(true);
  await musicaParaClip(clip({ modo: "pad", animo: "reflexivo" }), proyecto, 30, deps);
  expect(pads[1]).toMatchObject({ animo: "reflexivo", duracion: 31 });
});

test("modo pista usa la elegida (o el ánimo si ya no existe); modo ninguna, sin música", async () => {
  const a = await agregarPista(archivo("mia.mp3"), deps);
  expect(await musicaParaClip(clip({ modo: "pista", pista: a.id }), proyecto, 30, deps)).toBe(join(datos, "musica", a.id));
  expect(await musicaParaClip(clip({ modo: "pista", pista: "borrada.mp3" }), proyecto, 30, deps)).toMatch(/pad/);
  expect(await musicaParaClip(clip({ modo: "ninguna" }), proyecto, 30, deps)).toBeNull();
});

test("vista previa: usa la pista del ánimo sin contarla como usada", async () => {
  const { musicaParaVista } = await import("../../../src/main/musica/banco");
  const a = await agregarPista(archivo("a.mp3"), deps);
  await cambiarAnimo(a.id, "esperanza");
  expect(await musicaParaVista(clip({}), proyecto, 40, deps)).toEqual({ tipo: "musica", nombre: a.id });
  expect(existsSync(join(carpetaProyecto(proyecto.id), "musica-usada.json"))).toBe(false);
});

test("vista previa sin pistas: un pad guardado en caché por ánimo y tonalidad (no se genera cada vez)", async () => {
  const { musicaParaVista } = await import("../../../src/main/musica/banco");
  const r1 = await musicaParaVista(clip({ tonalidad: "Sol" }), proyecto, 40, deps);
  const r2 = await musicaParaVista(clip({ tonalidad: "Sol" }), proyecto, 70, deps);
  expect(r1).toEqual({ tipo: "cache", nombre: "pad-esperanza-Sol.wav" });
  expect(r2).toEqual(r1);
  expect(pads).toHaveLength(1);
  expect(pads[0].duracion).toBeGreaterThanOrEqual(120);
  expect(await musicaParaVista(clip({ modo: "ninguna" }), proyecto, 40, deps)).toBeNull();
});
