import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { palabrasDe } from "@shared/reel/tiempo";
import { bloquesSrt, textoSrt } from "@shared/srt";
import { slugTitulo } from "../exportar/tarea";
import { leerProyecto, leerTranscripcion } from "../proyectos/almacen";
import { carpetaProyecto } from "../rutas";

/** Carpeta de entregas de la prédica (la misma de los reels exportados). */
export async function carpetaEntregas(proyectoId: string): Promise<string> {
  const dir = join(carpetaProyecto(proyectoId), "exportados");
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Nombre base de los archivos de la prédica: "Culto dominical · 9 nov" → "culto-dominical-9-nov". */
export async function baseEntregas(proyectoId: string): Promise<string> {
  return slugTitulo((await leerProyecto(proyectoId)).nombre);
}

/**
 * Subtítulos SRT de la prédica (transcripción corregida). `completo`: tiempos del video completo del culto;
 * si no, desde el inicio de la prédica. Devuelve el nombre del archivo en exportados/.
 */
export async function guardarSrt(proyectoId: string, opciones: { completo: boolean }): Promise<string> {
  const t = await leerTranscripcion(proyectoId);
  if (!t?.segmentos.length) throw new Error("No hay transcripción para crear los subtítulos.");
  const nombre = `${await baseEntregas(proyectoId)}.srt`;
  // Las palabras están en segundos del video completo.
  const desplazar = opciones.completo ? 0 : -t.inicio;
  await writeFile(join(await carpetaEntregas(proyectoId), nombre), textoSrt(bloquesSrt(palabrasDe(t)), desplazar), "utf8");
  return nombre;
}
