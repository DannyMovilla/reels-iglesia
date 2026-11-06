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
