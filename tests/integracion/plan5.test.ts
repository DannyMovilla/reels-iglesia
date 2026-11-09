import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { normalizarAudio } from "../../src/main/exportar/mezcla";
import { prepararCarpeta } from "../../src/main/exportar/preparar";
import { renderizar } from "../../src/main/exportar/render";
import { argsVozLimpia } from "../../src/main/procesos/audio";
import { construirComposicion } from "../../src/shared/reel/composicion";
import { palabrasDe, partesDelReel } from "../../src/shared/reel/tiempo";
import type { ClipSpec, Transcripcion } from "../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3, SIN_MUSICA } from "../ayuda/plan3";

const RAIZ = resolve(__dirname, "../..");

function medir(mp4: string): { lufs: number; pico: number } {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", mp4, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const resumen = r.slice(r.lastIndexOf("Summary:"));
  return { lufs: Number(/I:\s+(-?[0-9.]+) LUFS/.exec(resumen)![1]), pico: Number(/Peak:\s+(-?[0-9.]+) dBFS/.exec(resumen)![1]) };
}

/** Audio del MP4 en muestras mono de 48 kHz (float). */
function muestras(mp4: string): Float32Array {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", mp4, "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}
const saltoMax = (x: Float32Array, a: number, b: number) => {
  let m = 0;
  for (let i = Math.max(1, a); i < Math.min(x.length, b); i++) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
  return m;
};

test("plan 5: cortes Fuerte + tramo quitado + voz Podcast + efectos → −14 LUFS, sin «clic» en los cortes", async () => {
  const video = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], { encoding: "utf8" })
    .trim().split(/\r?\n/).pop()!;
  const trans = mkdtempSync(join(tmpdir(), "reels-p5-t-"));
  execFileSync(join(RAIZ, ".venv/Scripts/python.exe"), [join(RAIZ, "python/transcribir.py"), video, "--inicio", "0", "--salida", trans,
    "--solo-transcripcion", "--modelo", "tiny", "--dispositivo", "cpu"], { env: { ...process.env, PYTHONUTF8: "1" } });
  const t: Transcripcion = JSON.parse(readFileSync(join(trans, "transcripcion.json"), "utf8"));
  const ws = palabrasDe(t).filter((w) => w.e <= 15);
  const dir = mkdtempSync(join(tmpdir(), "reels-p5-"));
  execFileSync("ffmpeg", argsVozLimpia(video, 0, 30, join(dir, "voz.m4a"), "podcast"));
  const clip: ClipSpec = {
    id: "c", titulo: "Prueba", gancho: "La fidelidad de Dios", ganchosAlternativos: [], categoria: "Esperanza", inicio: t.segmentos[0].s, fin: 15,
    apertura: null, palabrasClave: [], versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [],
    encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
    ...PLAN3, musica: SIN_MUSICA, cortes: { pausas: true, muletillas: true, intensidad: "fuerte", quitados: [{ inicio: ws[3].s, fin: ws[5].e }] },
    efectos: { ...PLAN3.efectos, sonidos: true }, voz: "podcast", cierre: true, formatos: ["9:16"], estado: "sugerido",
  };
  const comp = construirComposicion({ clip, transcripcion: t, caras: null, formato: "9:16", dimensiones: { ancho: 1280, alto: 720 },
    marca: { nombre: "Mi iglesia", color: "#f2b544", invitacion: "Síguenos", ...MARCA_PLAN3 }, fuenteVideo: video.replace(/\\/g, "/"),
    recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", efectos: "recursos/efectos" }, modo: "render",
    voz: { src: "voz.m4a", inicioRango: 0 } });
  expect(comp.html).toContain('class="clip efecto"');
  await prepararCarpeta(dir, comp.html);
  const salida = join(dir, "salida.mp4");
  await renderizar(dir, salida, { gpu: true, senal: new AbortController().signal, alProgreso: () => {} });
  await normalizarAudio(salida);
  const m = medir(salida);
  expect(m.lufs).toBeGreaterThanOrEqual(-15);
  expect(m.lufs).toBeLessThanOrEqual(-13);
  expect(m.pico).toBeLessThanOrEqual(-1);

  // En cada corte de la voz, el salto entre muestras vecinas (±5 ms) no supera al de la voz alrededor (±200 ms).
  const x = muestras(salida);
  const tramos = partesDelReel(clip, palabrasDe(t)).find((p) => p.tipo === "clip")!.tramos!;
  expect(tramos.length).toBeGreaterThan(1);
  for (const tr of tramos.slice(1)) {
    const i = Math.round(tr.inicioReel * 48000);
    const corte = saltoMax(x, i - 240, i + 240);
    const alrededor = Math.max(saltoMax(x, i - 9600, i - 240), saltoMax(x, i + 240, i + 9600));
    expect(corte, `corte en ${tr.inicioReel} s`).toBeLessThanOrEqual(alrededor * 1.05 + 1e-4);
  }
}, 400_000);
