import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import * as electron from "electron";

/** Carpeta de datos: <Documentos>/Reels Iglesia, o REELS_IGLESIA_DATOS (pruebas). */
export function carpetaDatos(): string {
  if (process.env.REELS_IGLESIA_DATOS) return process.env.REELS_IGLESIA_DATOS;
  return join(electron.app.getPath("documents"), "Reels Iglesia");
}

/** Registros de la app: <datos de prueba>/registros con REELS_IGLESIA_DATOS; si no, %APPDATA%\Reels Iglesia\registros. */
export function carpetaRegistros(): string {
  if (process.env.REELS_IGLESIA_DATOS) return join(process.env.REELS_IGLESIA_DATOS, "registros");
  return join(electron.app.getPath("appData"), "Reels Iglesia", "registros");
}

interface Entorno { empaquetada: boolean; recursos: string }
const entornoActual = (): Entorno => ({ empaquetada: !!electron.app?.isPackaged, recursos: process.resourcesPath ?? "" });

/**
 * Donde están los node_modules que se ejecutan fuera de Electron (CLI de HyperFrames, GSAP, fuentes):
 * en desarrollo el repositorio; instalada, resources/app.asar.unpacked (asarUnpack del instalador).
 */
export const raizApp = (e: Entorno = entornoActual()): string => (e.empaquetada ? join(e.recursos, "app.asar.unpacked") : resolve(__dirname, "..", ".."));

/** Librería de escenas animadas (resources/escenas en el repositorio y en la app instalada). */
export const rutaEscenas = (): string => join(raizRecursos(), "resources", "escenas");
/** Efectos de sonido propios (python/efectos.py), incluidos en la app. */
export const rutaEfectos = (): string => join(raizRecursos(), "resources", "efectos");
/** Pinturas clásicas de dominio público incluidas en la app. */
export const rutaPinturas = (): string => join(raizRecursos(), "resources", "pinturas");

/** Donde están python/ y modelos/: el repositorio en desarrollo; resources/ instalada (extraResources). */
export const raizRecursos = (e: Entorno = entornoActual()): string => (e.empaquetada ? e.recursos : raizApp(e));
/** Entorno de Python que prepara el asistente: en %LOCALAPPDATA% (la carpeta de la app instalada no se puede escribir). */
export const rutaEntorno = (): string => join(process.env.LOCALAPPDATA ?? electron.app.getPath("userData"), "Reels Iglesia", "venv");

/** Python de la app: REELS_PYTHON, el .venv del repositorio (desarrollo) o el entorno del asistente. */
export function rutaPython(): string {
  if (process.env.REELS_PYTHON) return process.env.REELS_PYTHON;
  const desarrollo = join(raizApp(), ".venv", "Scripts", "python.exe");
  return existsSync(desarrollo) ? desarrollo : join(rutaEntorno(), "Scripts", "python.exe");
}
export const rutaTranscriptor = (): string => join(raizRecursos(), "python", "transcribir.py");

export const carpetaProyectos = (): string => join(carpetaDatos(), "proyectos");
export const carpetaProyecto = (id: string): string => join(carpetaProyectos(), id);
