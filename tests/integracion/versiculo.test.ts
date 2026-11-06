import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { normalizarAudio } from "../../src/main/exportar/mezcla";
import { prepararCarpeta } from "../../src/main/exportar/preparar";
import { renderizar } from "../../src/main/exportar/render";
import { construirReelVersiculo } from "../../src/shared/reel/versiculo-reel";
import type { Creacion } from "../../src/shared/tipos";
import { MARCA_PLAN3 } from "../ayuda/plan3";

const RAIZ = resolve(__dirname, "../..");
const creacion = (fondo: Creacion["fondo"]): Creacion => ({
  id: "c", creado: "", entrada: { tipo: "versiculo", texto: "Juan 8:12" },
  versiculo: { ref: "Juan 8:12", texto: "Yo soy la luz del mundo; el que me sigue, no andará en tinieblas, sino que tendrá la luz de la vida.", confirmado: true },
  gancho: "No camines a oscuras", reflexion: "Jesús sigue siendo tu luz.", palabrasClave: ["luz", "vida"],
  musica: { modo: "auto", pista: null, animo: "esperanza", tonalidad: "Re", volumen: 0.18 }, subtitulos: { estilo: "pop" }, fondo,
  redes: { instagram: { texto: "", hashtags: [] }, tiktok: { texto: "", hashtags: [] }, facebook: { texto: "" }, youtube: { titulo: "", texto: "" } },
  formatos: ["9:16"], estado: "borrador",
});
const marca = { nombre: "Iglesia Familia", color: "#f2b544", invitacion: "Síguenos", ...MARCA_PLAN3, redes: { instagram: "iglesiafamilia" } };

function medir(mp4: string) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const res = r.slice(r.lastIndexOf("Summary:"));
  return { lufs: Number(/I:\s+(-?[0-9.]+) LUFS/.exec(res)![1]), pico: Number(/Peak:\s+(-?[0-9.]+) dBFS/.exec(res)![1]) };
}
/** Brillo medio (0–255) del cuadro en el segundo t. */
function brillo(mp4: string, t: number): number {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", mp4, "-frames:v", "1", "-vf", "scale=54:96,format=gray", "-f", "rawvideo", "-"]);
  return raw.reduce((a, b) => a + b, 0) / raw.length;
}

async function exportar(fondo: Creacion["fondo"], gpu: boolean, extra: Record<string, string> = {}, fondoSrc?: string) {
  const dir = mkdtempSync(join(tmpdir(), "reels-vers-"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=40", "-f", "lavfi", "-i", "sine=f=330:d=40", "-filter_complex", "amix=inputs=2", "-ac", "2", join(dir, "musica.wav")]);
  const comp = construirReelVersiculo({ creacion: creacion(fondo), marca, formato: "9:16", modo: "render", fondoSrc,
    recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", escenas: "recursos/escenas/shaders.iife.js" }, musica: { src: "musica.wav" } });
  await prepararCarpeta(dir, comp.html, { "recursos/escenas/shaders.iife.js": join(RAIZ, "resources", "escenas", "shaders.iife.js"), ...extra });
  const salida = join(dir, "reel.mp4");
  await renderizar(dir, salida, { gpu, senal: new AbortController().signal, alProgreso: () => {} });
  await normalizarAudio(salida);
  return { salida, duracion: comp.duracion };
}

test("reel de versículo con la escena «luz» (GPU): se ve, se mueve y suena a −14 LUFS", async () => {
  const { salida, duracion } = await exportar({ tipo: "escena", escena: "luz" }, true);
  const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", salida], { encoding: "utf8" }));
  expect(Math.abs(Number(info.format.duration) - duracion)).toBeLessThan(0.2);
  expect(brillo(salida, 1)).toBeGreaterThan(20); // la escena no queda negra
  expect(Math.abs(brillo(salida, 3) - brillo(salida, 6))).toBeGreaterThan(0.5);
  const m = medir(salida);
  expect(m.lufs).toBeGreaterThanOrEqual(-15);
  expect(m.lufs).toBeLessThanOrEqual(-13);
  expect(m.pico).toBeLessThanOrEqual(-1);
}, 400_000);

test("reel de versículo con foto propia, sin GPU", async () => {
  const foto = join(mkdtempSync(join(tmpdir(), "foto-")), "fondo.jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=1", "-frames:v", "1", foto]);
  const { salida } = await exportar({ tipo: "imagen", archivo: foto }, false, { "fondo.jpg": foto }, "fondo.jpg");
  expect(brillo(salida, 4)).toBeGreaterThan(15);
  writeFileSync(join(tmpdir(), "ultimo-reel-versiculo.txt"), salida);
}, 400_000);
