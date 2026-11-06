import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { argsYtdlp, descargarVideo, esEnlace } from "../../../src/main/descargas/ytdlp";

const FALSO: [string, string[]] = ["node", [resolve(__dirname, "../../fixtures/falso-ytdlp.mjs")]];
let carpeta: string;
beforeEach(() => { carpeta = mkdtempSync(join(tmpdir(), "reels-dl-")); });
const bajar = (modo: string, senal = new AbortController().signal, progreso: number[] = []) => {
  process.env.FALSO_YTDLP_MODO = modo;
  return descargarVideo("https://www.facebook.com/iglesia/videos/123", carpeta, { senal, alProgreso: (p) => progreso.push(p), comando: FALSO });
};

test("argumentos: mejor calidad hasta 1080p en MP4, sin listas, progreso por línea y la ruta final", () => {
  expect(argsYtdlp("https://youtu.be/x", "C:/datos/videos")).toEqual([
    "-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--merge-output-format", "mp4", "--no-playlist", "--newline",
    "-o", "C:/datos/videos/%(title).80s.%(ext)s", "--print", "after_move:filepath", "https://youtu.be/x",
  ]);
});

test("descarga con progreso y devuelve la ruta del video", async () => {
  const progreso: number[] = [];
  const ruta = await bajar("ok", undefined, progreso);
  expect(ruta).toBe(join(carpeta, "Culto dominical.mp4"));
  expect(progreso).toEqual([0.5, 25, 50.3, 99.9, 100]);
});

test.each([
  ["privado", /privado o pide iniciar sesión/],
  ["no-video", /no parece un video/],
  ["sin-red", /internet/],
])("error %s en español", async (modo, mensaje) => {
  await expect(bajar(modo)).rejects.toThrow(mensaje);
});

test("cancelar borra lo descargado a medias", async () => {
  const c = new AbortController();
  const promesa = bajar("lento", c.signal);
  await new Promise((r) => setTimeout(r, 600));
  c.abort();
  await expect(promesa).rejects.toThrow(/cancel/i);
  expect(readdirSync(carpeta)).toEqual([]);
});

test("reconoce enlaces", () => {
  expect(esEnlace("https://www.facebook.com/iglesia/videos/123")).toBe(true);
  expect(esEnlace("youtube.com/watch?v=abc")).toBe(true);
  expect(esEnlace("culto del domingo")).toBe(false);
  expect(existsSync(carpeta)).toBe(true);
});
