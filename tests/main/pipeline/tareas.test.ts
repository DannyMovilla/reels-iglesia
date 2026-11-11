import { existsSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { crearProyecto, leerProyecto } from "../../../src/main/proyectos/almacen";
import { crearEjecutores, marcarInterrumpidos } from "../../../src/main/pipeline/tareas";
import { carpetaProyecto } from "../../../src/main/rutas";
import type { ResultadoProceso, OpcionesProceso } from "../../../src/main/procesos/lineas";
import type { Tarea, TipoTarea } from "../../../src/shared/tipos";

let proyectoId: string;
let rutaVideo: string;

beforeEach(async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-pipe-"));
  delete process.env.REELS_WHISPER_MODELO;
  rutaVideo = join(mkdtempSync(join(tmpdir(), "reels-v-")), "Culto.domingo-20261108-(1280p).mp4");
  writeFileSync(rutaVideo, Buffer.alloc(10));
  const p = await crearProyecto({
    nombre: "Culto",
    video: { ruta: rutaVideo, tamano: statSync(rutaVideo).size, modificado: 0, duracion: 10000 },
    rango: { inicio: 6284, fin: 9155 },
  });
  proyectoId = p.id;
});

const tarea = (tipo: TipoTarea): Tarea => ({ id: "t", proyectoId, tipo, estado: "corriendo", pct: 0, creada: "" });

test("transcribir llama a Python con los argumentos exactos, reenvía el progreso y encola la limpieza del audio", async () => {
  const llamadas: string[][] = [];
  const encoladas: [string, TipoTarea][] = [];
  const progresos: number[] = [];
  const ejecutar = async (cmd: string, args: string[], op?: OpcionesProceso): Promise<ResultadoProceso> => {
    llamadas.push([cmd, ...args]);
    op?.alProgreso?.({ etapa: "transcripcion", pct: 40 });
    return { codigo: 0, stdout: "", stderr: "" };
  };
  const ej = crearEjecutores({ python: "py.exe", script: "transcribir.py", ejecutar, encolar: (id, t) => encoladas.push([id, t]), analizar: async () => {} });
  await ej.transcribir(tarea("transcribir"), { alProgreso: (pct) => progresos.push(pct), senal: new AbortController().signal });
  expect(llamadas[0]).toEqual([
    "py.exe", "transcribir.py", rutaVideo, "--inicio", "6284", "--fin", "9155",
    "--solo-transcripcion", "--salida", carpetaProyecto(proyectoId), "--progreso-json",
  ]);
  expect(progresos).toContain(40);
  const p = await leerProyecto(proyectoId);
  expect(p.pasos.transcripcion.estado).toBe("ok");
  expect(encoladas).toEqual([[proyectoId, "audio"]]);
});

test("REELS_WHISPER_MODELO agrega --modelo", async () => {
  process.env.REELS_WHISPER_MODELO = "tiny";
  const llamadas: string[][] = [];
  const ej = crearEjecutores({
    python: "py.exe", script: "s.py", encolar: () => {}, analizar: async () => {},
    ejecutar: async (_c, args) => { llamadas.push(args); return { codigo: 0, stdout: "", stderr: "" }; },
  });
  await ej.caras(tarea("caras"), { alProgreso: () => {}, senal: new AbortController().signal });
  expect(llamadas[0]).toContain("--solo-caras");
  expect(llamadas[0].slice(-2)).toEqual(["--modelo", "tiny"]);
});

test("un código de salida distinto de 0 deja el paso en error con las últimas 5 líneas de stderr", async () => {
  const stderr = ["l1", "l2", "l3", "l4", "l5", "l6", "RuntimeError: cublas64_12.dll"].join("\n");
  const ej = crearEjecutores({
    python: "py.exe", script: "s.py", encolar: () => {}, analizar: async () => {},
    ejecutar: async () => ({ codigo: 1, stdout: "", stderr }),
  });
  await expect(ej.transcribir(tarea("transcribir"), { alProgreso: () => {}, senal: new AbortController().signal })).rejects.toThrow();
  const p = await leerProyecto(proyectoId);
  expect(p.pasos.transcripcion.estado).toBe("error");
  expect(p.pasos.transcripcion.detalle).toBe(["l3", "l4", "l5", "l6", "RuntimeError: cublas64_12.dll"].join("\n"));
  expect(p.estado).toBe("error");
});

test("Python se ejecuta en UTF-8 para que acentos y ñ no se rompan", async () => {
  let env: NodeJS.ProcessEnv | undefined;
  const ej = crearEjecutores({
    python: "py.exe", script: "s.py", encolar: () => {}, analizar: async () => {},
    ejecutar: async (_c, _a, op) => { env = op?.env; return { codigo: 0, stdout: "", stderr: "" }; },
  });
  await ej.transcribir(tarea("transcribir"), { alProgreso: () => {}, senal: new AbortController().signal });
  expect(env?.PYTHONUTF8).toBe("1");
  expect(env?.PYTHONIOENCODING).toBe("utf-8");
});

test("si falta el Python de la app, el error está en español", async () => {
  const ej = crearEjecutores({
    python: "py.exe", script: "s.py", encolar: () => {}, analizar: async () => {},
    ejecutar: async () => { throw Object.assign(new Error("spawn py.exe ENOENT"), { code: "ENOENT" }); },
  });
  await expect(ej.transcribir(tarea("transcribir"), { alProgreso: () => {}, senal: new AbortController().signal }))
    .rejects.toThrow("Falta preparar el entorno de Python de la app. Abre Ajustes.");
});

test("al abrir la app, los proyectos con tareas interrumpidas dejan de mostrarse como en curso", async () => {
  const p = await leerProyecto(proyectoId);
  p.estado = "transcribiendo";
  const { guardarProyecto } = await import("../../../src/main/proyectos/almacen");
  await guardarProyecto(p);
  await marcarInterrumpidos([{ ...tarea("transcribir"), estado: "interrumpida" }]);
  const q = await leerProyecto(proyectoId);
  expect(q.estado).toBe("error");
  expect(q.pasos.transcripcion).toEqual({ estado: "error", detalle: "Se interrumpió al cerrar la app." });
});

test("audio limpia la voz con FFmpeg en la carpeta del proyecto y encola caras", async () => {
  const llamadas: [string, string[]][] = [];
  const encoladas: TipoTarea[] = [];
  const ej = crearEjecutores({
    python: "py.exe", script: "s.py", encolar: (_id, t) => encoladas.push(t), analizar: async () => {},
    ejecutar: async (cmd, args, op) => { llamadas.push([cmd, args]); writeFileSync(args.at(-1)!, "m4a"); op?.alLinea?.("out_time_ms=1435750000"); return { codigo: 0, stdout: "", stderr: "" }; },
  });
  const progresos: number[] = [];
  await ej.audio(tarea("audio"), { alProgreso: (pct) => progresos.push(pct), senal: new AbortController().signal });
  expect(llamadas[0][0]).toBe("ffmpeg");
  expect(llamadas[0][1].at(-1)).toBe(join(carpetaProyecto(proyectoId), "voz.tmp.m4a"));
  expect(existsSync(join(carpetaProyecto(proyectoId), "voz.m4a"))).toBe(true);
  expect(progresos.some((x) => Math.abs(x - 50) < 1)).toBe(true);
  expect((await leerProyecto(proyectoId)).pasos.audio.estado).toBe("ok");
  expect(encoladas).toEqual(["caras"]);
});

test("un proyecto de antes sin el paso de audio lo lee como pendiente", async () => {
  const { guardarProyecto } = await import("../../../src/main/proyectos/almacen");
  const p = await leerProyecto(proyectoId);
  delete (p.pasos as Partial<typeof p.pasos>).audio;
  await guardarProyecto(p);
  expect((await leerProyecto(proyectoId)).pasos.audio).toEqual({ estado: "pendiente" });
});
