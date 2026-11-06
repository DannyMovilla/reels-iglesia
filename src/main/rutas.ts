import { join } from "node:path";
import * as electron from "electron";

/** Carpeta de datos: <Documentos>/Reels Iglesia, o REELS_IGLESIA_DATOS (pruebas). */
export function carpetaDatos(): string {
  if (process.env.REELS_IGLESIA_DATOS) return process.env.REELS_IGLESIA_DATOS;
  return join(electron.app.getPath("documents"), "Reels Iglesia");
}

/** Raíz de la app (en desarrollo, la carpeta del repositorio). */
export const raizApp = (): string => electron.app.getAppPath();
/** Python del .venv de la app, o REELS_PYTHON. */
export const rutaPython = (): string => process.env.REELS_PYTHON ?? join(raizApp(), ".venv", "Scripts", "python.exe");
export const rutaTranscriptor = (): string => join(raizApp(), "python", "transcribir.py");

export const carpetaProyectos = (): string => join(carpetaDatos(), "proyectos");
export const carpetaProyecto = (id: string): string => join(carpetaProyectos(), id);
