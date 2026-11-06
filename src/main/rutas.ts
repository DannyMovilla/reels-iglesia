import { join } from "node:path";
import * as electron from "electron";

/** Carpeta de datos: <Documentos>/Reels Iglesia, o REELS_IGLESIA_DATOS (pruebas). */
export function carpetaDatos(): string {
  if (process.env.REELS_IGLESIA_DATOS) return process.env.REELS_IGLESIA_DATOS;
  return join(electron.app.getPath("documents"), "Reels Iglesia");
}

export const carpetaProyectos = (): string => join(carpetaDatos(), "proyectos");
export const carpetaProyecto = (id: string): string => join(carpetaProyectos(), id);
