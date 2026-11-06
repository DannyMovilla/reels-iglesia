import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { carpetaCreacion, crearCreacion, guardarCreacion, leerCreacion } from "../../../src/main/ia/almacen";
import { crearEjecutorExportarIa, type DepsExportarIa } from "../../../src/main/ia/exportar";
import type { Creacion, Tarea } from "../../../src/shared/tipos";

let c: Creacion;
let vistos: { html: string; archivos: string[] }[];
const ctx = () => ({ alProgreso: () => {}, senal: new AbortController().signal });
const deps = (extra: Partial<DepsExportarIa> = {}): DepsExportarIa => ({
  gpu: async () => false,
  normalizar: async () => {},
  portada: async (_m, _t, salida) => writeFileSync(salida, "jpg"),
  musica: async () => null,
  duracionVideo: async () => 6,
  renderizar: async (dir, salida) => {
    vistos.push({ html: readFileSync(join(dir, "index.html"), "utf8"), archivos: readdirSync(dir, { recursive: true }) as string[] });
    writeFileSync(salida, "mp4");
  },
  ...extra,
});
const tarea = (formato: "9:16" | "4:5" = "9:16"): Tarea => ({ id: `t-${formato.replace(":", "x")}-${Math.random().toString(36).slice(2)}`, proyectoId: `ia:${c.id}`, tipo: "exportar-ia", estado: "corriendo", pct: 0, creada: "", creacionId: c.id, formato });

beforeEach(async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-iaexp-"));
  vistos = [];
  c = await crearCreacion({ tipo: "versiculo", texto: "Juan 8:12" });
  c = { ...c, versiculo: { ref: "Juan 8:12", texto: "Yo soy la luz del mundo; el que me sigue, no andará en tinieblas.", confirmado: true }, gancho: "No camines a oscuras", reflexion: "Jesús es tu luz.",
    redes: { instagram: { texto: "IG", hashtags: ["#fe"] }, tiktok: { texto: "TT", hashtags: [] }, facebook: { texto: "FB" }, youtube: { titulo: "YT", texto: "" } } };
  await guardarCreacion(c);
});

test("sin el versículo confirmado no se exporta", async () => {
  await guardarCreacion({ ...c, versiculo: { ...c.versiculo, confirmado: false } });
  await expect(crearEjecutorExportarIa(deps())(tarea(), ctx())).rejects.toThrow("Confirma el texto de Juan 8:12 antes de exportar.");
});

test("con escena: lleva la librería de escenas; deja MP4, portada y textos; marca la creación exportada", async () => {
  await crearEjecutorExportarIa(deps())(tarea(), ctx());
  expect(vistos[0].html).toContain('data-shader="Godrays"');
  expect(vistos[0].archivos.some((a) => a.replace(/\\/g, "/") === "recursos/escenas/shaders.iife.js")).toBe(true);
  expect(readdirSync(join(carpetaCreacion(c.id), "exportados")).sort()).toEqual(["juan-8-12-9x16-portada.jpg", "juan-8-12-9x16.mp4", "juan-8-12-textos.txt"]);
  expect(readFileSync(join(carpetaCreacion(c.id), "exportados", "juan-8-12-textos.txt"), "utf8")).toContain("#fe");
  expect((await leerCreacion(c.id)).estado).toBe("exportado");
});

test("con foto o video propio: lo copia a la carpeta del reel; el video se repite según su duración", async () => {
  const foto = join(carpetaCreacion(c.id), "fondo.jpg");
  writeFileSync(foto, "jpg");
  await guardarCreacion({ ...c, fondo: { tipo: "imagen", archivo: foto } });
  await crearEjecutorExportarIa(deps())(tarea(), ctx());
  expect(vistos[0].archivos).toContain("fondo.jpg");
  expect(vistos[0].html).toContain('<img id="fondo" class="fondo" src="fondo.jpg"');
  const video = join(carpetaCreacion(c.id), "fondo.mp4");
  writeFileSync(video, "mp4");
  await guardarCreacion({ ...c, fondo: { tipo: "video", archivo: video } });
  await crearEjecutorExportarIa(deps())(tarea(), ctx());
  expect((vistos[1].html.match(/class="clip fondo" src="fondo\.mp4"/g) ?? []).length).toBeGreaterThan(1);
});

test("con música: la copia y la mezcla", async () => {
  const pista = join(mkdtempSync(join(tmpdir(), "m-")), "pad.wav");
  writeFileSync(pista, "wav");
  await crearEjecutorExportarIa(deps({ musica: async () => pista }))(tarea(), ctx());
  expect(vistos[0].archivos).toContain("musica.wav");
  expect(vistos[0].html).toContain('<audio id="musica" class="clip" src="musica.wav"');
});

test("exportar dos veces no pisa el archivo anterior", async () => {
  await crearEjecutorExportarIa(deps())(tarea(), ctx());
  await crearEjecutorExportarIa(deps())(tarea(), ctx());
  const mp4 = readdirSync(join(carpetaCreacion(c.id), "exportados")).filter((a) => a.endsWith(".mp4")).sort();
  expect(mp4).toEqual(["juan-8-12-2-9x16.mp4", "juan-8-12-9x16.mp4"]);
  expect(existsSync(join(carpetaCreacion(c.id), "tmp"))).toBe(true);
});

test("revisión I5: exporta la versión que había al tocar Exportar, aunque después se siga editando", async () => {
  const instantanea = { ...c, gancho: "Gancho al exportar" };
  await guardarCreacion({ ...c, gancho: "Editado después", versiculo: { ...c.versiculo, confirmado: false } });
  await crearEjecutorExportarIa(deps())({ ...tarea(), instantaneaIa: instantanea }, ctx());
  expect(vistos[0].html).toContain("Gancho al exportar");
  expect(vistos[0].html).not.toContain("Editado después");
});
