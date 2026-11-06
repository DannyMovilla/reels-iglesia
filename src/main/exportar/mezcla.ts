import { rename, rm } from "node:fs/promises";
import { ejecutarConProgreso } from "../procesos/lineas";

/** Lo que mide la primera pasada de loudnorm (texto tal cual lo imprime FFmpeg). */
export interface MedicionLoudnorm { i: string; tp: string; lra: string; thresh: string; offset: string }

/** Nivel de Instagram/TikTok: −14 LUFS integrados, pico verdadero −1 dBTP. */
const OBJETIVO = "I=-14:TP=-1:LRA=11";

export const argsMedir = (mp4: string): string[] =>
  ["-hide_banner", "-nostats", "-i", mp4, "-vn", "-af", `loudnorm=${OBJETIVO}:print_format=json`, "-f", "null", "-"];

export function leerMedicion(salida: string): MedicionLoudnorm | null {
  const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(salida);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Record<string, string>;
    return { i: j.input_i, tp: j.input_tp, lra: j.input_lra, thresh: j.input_thresh, offset: j.target_offset };
  } catch {
    return null;
  }
}

/** Segunda pasada: normalización lineal con la medición + limitador (−1 dB) por si queda algún pico. El video no se recodifica. */
export function argsNormalizar(entrada: string, salida: string, m: MedicionLoudnorm): string[] {
  const filtro = `loudnorm=${OBJETIVO}:measured_I=${m.i}:measured_TP=${m.tp}:measured_LRA=${m.lra}:measured_thresh=${m.thresh}:offset=${m.offset}:linear=true,alimiter=limit=0.891:level=false`;
  return ["-v", "error", "-y", "-i", entrada, "-c:v", "copy", "-af", filtro, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", salida];
}

/** Deja el MP4 en −14 LUFS / −1 dBTP (reemplaza el archivo al terminar). */
export async function normalizarAudio(mp4: string, senal?: AbortSignal, ejecutar: typeof ejecutarConProgreso = ejecutarConProgreso): Promise<void> {
  const medida = await ejecutar("ffmpeg", argsMedir(mp4), { senal });
  const m = leerMedicion(medida.stderr);
  if (medida.codigo !== 0 || !m) throw new Error("No se pudo medir el volumen del reel.");
  const tmp = mp4.replace(/\.mp4$/i, ".norm.mp4");
  const r = await ejecutar("ffmpeg", argsNormalizar(mp4, tmp, m), { senal });
  if (r.codigo !== 0) {
    await rm(tmp, { force: true });
    throw new Error("No se pudo ajustar el volumen del reel.");
  }
  await rename(tmp, mp4);
}
