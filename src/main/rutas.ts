import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import * as electron from "electron";

/** Carpeta de datos: <Documentos>/Reels Iglesia, o REELS_IGLESIA_DATOS (pruebas). */
export function carpetaDatos(): string {
  if (process.env.REELS_IGLESIA_DATOS) return process.env.REELS_IGLESIA_DATOS;
  return join(electron.app.getPath("documents"), "Reels Iglesia");
}

/** Raíz de la app: el código compilado vive en <raíz>/out/main. (El instalador del plan 3 la ajustará.) */
export const raizApp = (): string => resolve(__dirname, "..", "..");
/** Entorno de Python que prepara el asistente: en %LOCALAPPDATA% (la carpeta de la app instalada no se puede escribir). */
export const rutaEntorno = (): string => join(process.env.LOCALAPPDATA ?? electron.app.getPath("userData"), "Reels Iglesia", "venv");

/** Python de la app: REELS_PYTHON, el .venv del repositorio (desarrollo) o el entorno del asistente. */
export function rutaPython(): string {
  if (process.env.REELS_PYTHON) return process.env.REELS_PYTHON;
  const desarrollo = join(raizApp(), ".venv", "Scripts", "python.exe");
  return existsSync(desarrollo) ? desarrollo : join(rutaEntorno(), "Scripts", "python.exe");
}
export const rutaTranscriptor = (): string => join(raizApp(), "python", "transcribir.py");

export const carpetaProyectos = (): string => join(carpetaDatos(), "proyectos");
export const carpetaProyecto = (id: string): string => join(carpetaProyectos(), id);
