import { ejecutarConProgreso } from "./lineas";

const ERROR = "No pude leer la duración del video. ¿Está instalado FFmpeg?";

/** Duración en segundos con ffprobe; errores en español (incluido FFmpeg no instalado). */
export async function duracionVideo(ruta: string, ejecutar: typeof ejecutarConProgreso = ejecutarConProgreso): Promise<number> {
  let r;
  try {
    r = await ejecutar("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ruta]);
  } catch {
    throw new Error(ERROR);
  }
  const d = Number(r.stdout.trim());
  if (r.codigo !== 0 || !Number.isFinite(d) || d <= 0) throw new Error(ERROR);
  return d;
}

/** Ancho y alto del primer stream de video (ffprobe). */
export async function dimensionesVideo(ruta: string, ejecutar: typeof ejecutarConProgreso = ejecutarConProgreso): Promise<{ ancho: number; alto: number }> {
  let r;
  try {
    r = await ejecutar("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", ruta]);
  } catch {
    throw new Error(ERROR);
  }
  const m = /(\d+)x(\d+)/.exec(r.stdout);
  if (r.codigo !== 0 || !m) throw new Error("No pude leer el tamaño del video. ¿Está instalado FFmpeg?");
  return { ancho: Number(m[1]), alto: Number(m[2]) };
}

/** ¿FFmpeg tiene el codificador NVENC de NVIDIA? (para exportar con --gpu). Se calcula una vez. */
let nvenc: Promise<boolean> | null = null;
export function hayNvenc(ejecutar: typeof ejecutarConProgreso = ejecutarConProgreso): Promise<boolean> {
  nvenc ??= ejecutar("ffmpeg", ["-hide_banner", "-encoders"]).then((r) => r.codigo === 0 && /h264_nvenc/.test(r.stdout), () => false);
  return nvenc;
}
