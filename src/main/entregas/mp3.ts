import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import type { NivelVoz } from "@shared/tipos";
import { argsMedir, leerMedicion, type MedicionLoudnorm } from "../exportar/mezcla";
import { asegurarVoz } from "../exportar/tarea";
import { ejecutarConProgreso } from "../procesos/lineas";
import { leerMarca, leerProyecto } from "../proyectos/almacen";
import { baseEntregas, carpetaEntregas } from "./entregas";

/** Nivel de los podcasts: −16 LUFS integrados, pico verdadero −1,5 dBTP. */
const OBJETIVO = "I=-16:TP=-1.5:LRA=11";

export interface DatosMp3 {
  voz: string;
  salida: string;
  medicion: MedicionLoudnorm;
  titulo: string;
  artista: string;
  album: string;
  anio: string;
  /** Logo PNG o JPG para la carátula. */
  caratula?: string;
}

/** FFmpeg: la voz de la prédica en MP3 de 128 kbps a nivel de podcast, con etiquetas y carátula. */
export function argsMp3(d: DatosMp3): string[] {
  const m = d.medicion;
  const filtro = `loudnorm=${OBJETIVO}:measured_I=${m.i}:measured_TP=${m.tp}:measured_LRA=${m.lra}:measured_thresh=${m.thresh}:offset=${m.offset}:linear=true,alimiter=limit=0.891:level=false`;
  return [
    "-v", "error", "-y", "-i", d.voz,
    ...(d.caratula ? ["-i", d.caratula] : []),
    "-map", "0:a", "-af", filtro,
    "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", "-id3v2_version", "3",
    ...(d.caratula ? ["-map", "1:v", "-c:v", "mjpeg", "-disposition:v", "attached_pic", "-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)"] : []),
    "-metadata", `title=${d.titulo}`, "-metadata", `artist=${d.artista}`, "-metadata", `album=${d.album}`, "-metadata", `date=${d.anio}`,
    d.salida,
  ];
}

/** Mide la voz (primera pasada de loudnorm) y escribe el MP3. */
export async function codificarMp3(d: Omit<DatosMp3, "medicion">, ejecutar: typeof ejecutarConProgreso = ejecutarConProgreso): Promise<void> {
  const medida = await ejecutar("ffmpeg", argsMedir(d.voz, OBJETIVO));
  const medicion = leerMedicion(medida.stderr);
  if (medida.codigo !== 0 || !medicion) throw new Error("No se pudo medir el volumen de la prédica.");
  const r = await ejecutar("ffmpeg", argsMp3({ ...d, medicion }));
  if (r.codigo !== 0) throw new Error("No se pudo crear el MP3 de la prédica.");
}

/** La prédica en MP3 (exportados/<slug>.mp3) con la voz del nivel elegido; devuelve el nombre. */
export async function guardarMp3(proyectoId: string, nivel: NivelVoz = "limpia"): Promise<string> {
  const [p, marca] = await Promise.all([leerProyecto(proyectoId), leerMarca()]);
  if (!p.videoDisponible) throw new Error("No encuentro el video original. Vuelve a ponerlo en su lugar y reintenta.");
  const voz = await asegurarVoz(p, nivel);
  const nombre = `${await baseEntregas(proyectoId)}.mp3`;
  const logo = marca.logo && existsSync(marca.logo) && [".png", ".jpg", ".jpeg"].includes(extname(marca.logo).toLowerCase()) ? marca.logo : undefined;
  await codificarMp3({
    voz, salida: join(await carpetaEntregas(proyectoId), nombre), caratula: logo,
    titulo: p.nombre, artista: p.predicador ?? marca.predicador ?? marca.nombre, album: marca.nombre, anio: p.creado.slice(0, 4),
  });
  return nombre;
}
