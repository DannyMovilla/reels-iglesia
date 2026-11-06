import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { prepararCarpeta } from "../../src/main/exportar/preparar";
import { renderizar } from "../../src/main/exportar/render";
import { normalizarAudio } from "../../src/main/exportar/mezcla";
import { argsVozLimpia } from "../../src/main/procesos/audio";
import { construirComposicion } from "../../src/shared/reel/composicion";
import { duracionReel } from "../../src/shared/reel/tiempo";
import type { ClipSpec, Transcripcion } from "../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3, SIN_MUSICA } from "../ayuda/plan3";

const RAIZ = resolve(__dirname, "../..");

/** Saltos de más de 70 ms entre cuadros distintos (cuadros duplicados), como en el plan 1. */
function saltos(mp4: string): [number, number][] {
  const r = spawnSync("ffmpeg", ["-i", mp4, "-vf", "mpdecimate=hi=1:lo=1:frac=1,showinfo", "-map", "0:v", "-f", "null", "-"], { encoding: "utf8" });
  const t = [...r.stderr.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1]));
  const s: [number, number][] = [];
  for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] > 0.07) s.push([t[i - 1], t[i]]);
  return s;
}

test("exporta un clip de 15 s en 9:16 desde el video original", async () => {
  const video = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], { encoding: "utf8" })
    .trim().split(/\r?\n/).pop()!;
  const trans = mkdtempSync(join(tmpdir(), "reels-exp-t-"));
  execFileSync(join(RAIZ, ".venv/Scripts/python.exe"), [join(RAIZ, "python/transcribir.py"), video, "--inicio", "0", "--salida", trans,
    "--solo-transcripcion", "--modelo", "tiny", "--dispositivo", "cpu"], { env: { ...process.env, PYTHONUTF8: "1" } });
  const t: Transcripcion = JSON.parse(readFileSync(join(trans, "transcripcion.json"), "utf8"));
  const clip: ClipSpec = {
    id: "c", titulo: "Prueba", gancho: "La fidelidad de Dios", ganchosAlternativos: [], categoria: "Esperanza", inicio: t.segmentos[0].s, fin: 15,
    apertura: null, palabrasClave: ["Dios"], versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [],
    encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
    ...PLAN3, musica: SIN_MUSICA, cierre: true, formatos: ["9:16"], estado: "sugerido",
  };
  const comp = construirComposicion({ clip, transcripcion: t, caras: null, formato: "9:16", dimensiones: { ancho: 1280, alto: 720 },
    marca: { nombre: "Mi iglesia", color: "#f2b544", invitacion: "Síguenos", ...MARCA_PLAN3 }, fuenteVideo: video.replace(/\\/g, "/"),
    recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes" }, modo: "render" });
  const dir = mkdtempSync(join(tmpdir(), "reels-exp-"));
  await prepararCarpeta(dir, comp.html);
  const salida = join(dir, "salida.mp4");
  const progresos: number[] = [];
  await renderizar(dir, salida, { gpu: true, senal: new AbortController().signal, alProgreso: (p) => progresos.push(p) });

  const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", salida], { encoding: "utf8" }));
  const v = info.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  expect([v.width, v.height]).toEqual([1080, 1920]);
  expect(Math.abs(Number(info.format.duration) - duracionReel(clip))).toBeLessThan(0.15);
  expect(progresos.length).toBeGreaterThan(0);
  const finClip = duracionReel(clip) - 2.6;
  expect(saltos(salida).filter(([a]) => a < finClip - 0.1)).toEqual([]);
  const vol = spawnSync("ffmpeg", ["-i", salida, "-af", "volumedetect", "-vn", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const pico = Number(/max_volume: (-?[0-9.]+) dB/.exec(vol)?.[1]);
  expect(pico).toBeLessThanOrEqual(-1);
});

/** Volumen integrado (LUFS) y pico verdadero (dBTP) con ebur128. */
function medir(mp4: string): { lufs: number; pico: number } {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const resumen = r.slice(r.lastIndexOf("Summary:"));
  return { lufs: Number(/I:\s+(-?[0-9.]+) LUFS/.exec(resumen)![1]), pico: Number(/Peak:\s+(-?[0-9.]+) dBFS/.exec(resumen)![1]) };
}

test("voz limpia + música bajo la voz + normalización: −14 LUFS (±1) y pico ≤ −1 dBTP", async () => {
  const video = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], { encoding: "utf8" })
    .trim().split(/\r?\n/).pop()!;
  const trans = mkdtempSync(join(tmpdir(), "reels-mez-t-"));
  execFileSync(join(RAIZ, ".venv/Scripts/python.exe"), [join(RAIZ, "python/transcribir.py"), video, "--inicio", "0", "--salida", trans,
    "--solo-transcripcion", "--modelo", "tiny", "--dispositivo", "cpu"], { env: { ...process.env, PYTHONUTF8: "1" } });
  const t: Transcripcion = JSON.parse(readFileSync(join(trans, "transcripcion.json"), "utf8"));
  const dir = mkdtempSync(join(tmpdir(), "reels-mez-"));
  execFileSync("ffmpeg", argsVozLimpia(video, 0, 30, join(dir, "voz.m4a")));
  // Música de prueba fuerte (acorde de La): sin la mezcla y la normalización, el reel saturaría.
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=40", "-f", "lavfi", "-i", "sine=f=277:d=40", "-f", "lavfi", "-i", "sine=f=330:d=40",
    "-filter_complex", "amix=inputs=3,volume=6", "-ac", "2", join(dir, "musica.mp3")]);
  const clip: ClipSpec = {
    id: "c", titulo: "Prueba", gancho: "La fidelidad de Dios", ganchosAlternativos: [], categoria: "Esperanza", inicio: t.segmentos[0].s, fin: 15,
    apertura: null, palabrasClave: [], versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [],
    encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
    ...PLAN3, cierre: true, formatos: ["9:16"], estado: "sugerido",
  };
  const comp = construirComposicion({ clip, transcripcion: t, caras: null, formato: "9:16", dimensiones: { ancho: 1280, alto: 720 },
    marca: { nombre: "Mi iglesia", color: "#f2b544", invitacion: "Síguenos", ...MARCA_PLAN3 }, fuenteVideo: video.replace(/\\/g, "/"),
    recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes" }, modo: "render",
    voz: { src: "voz.m4a", inicioRango: 0 }, musica: { src: "musica.mp3" } });
  await prepararCarpeta(dir, comp.html);
  const salida = join(dir, "salida.mp4");
  await renderizar(dir, salida, { gpu: true, senal: new AbortController().signal, alProgreso: () => {} });
  await normalizarAudio(salida);
  const m = medir(salida);
  expect(m.lufs).toBeGreaterThanOrEqual(-15);
  expect(m.lufs).toBeLessThanOrEqual(-13);
  expect(m.pico).toBeLessThanOrEqual(-1);
}, 300_000);
