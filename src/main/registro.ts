import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { carpetaRegistros } from "./rutas";

/**
 * Registro de la app: un archivo por día en la carpeta de registros (7 días, 5 MB por archivo como mucho).
 * Nunca anota el texto de la prédica, prompts ni respuestas de Claude: solo eventos y errores, recortados a
 * 300 caracteres. Nunca hace fallar la app: si no puede escribir, se calla.
 */
export type Nivel = "info" | "aviso" | "error";

const MAX_MENSAJE = 300;
const TOPE = 5 * 1024 * 1024;
const LLENO = "registro lleno: no se anota nada más hoy";

let config: { carpeta?: string; ahora: () => Date; tope: number } = { ahora: () => new Date(), tope: TOPE };
const llenos = new Set<string>();

/** Para pruebas (y para fijar la carpeta al arrancar). */
export function configurarRegistro(o: { carpeta: string; ahora?: () => Date; tope?: number }): void {
  config = { carpeta: o.carpeta, ahora: o.ahora ?? (() => new Date()), tope: o.tope ?? TOPE };
  llenos.clear();
}

const carpeta = (): string => config.carpeta ?? carpetaRegistros();
const dosCifras = (n: number) => String(n).padStart(2, "0");
const fechaLocal = (d: Date) => `${d.getFullYear()}-${dosCifras(d.getMonth() + 1)}-${dosCifras(d.getDate())}`;
const archivoDe = (d: Date) => `reels-${fechaLocal(d)}.log`;
const ARCHIVO = /^reels-(\d{4})-(\d{2})-(\d{2})\.log$/;

function recortar(mensaje: string): string {
  const plano = String(mensaje).replace(/\s*[\r\n]+\s*/g, " ").trim();
  return plano.length > MAX_MENSAJE ? `${plano.slice(0, MAX_MENSAJE - 1)}…` : plano;
}

export function registrar(nivel: Nivel, origen: string, mensaje: string): void {
  try {
    const d = config.ahora();
    const dir = carpeta();
    mkdirSync(dir, { recursive: true });
    const nombre = archivoDe(d);
    if (llenos.has(nombre)) return;
    const ruta = join(dir, nombre);
    const linea = `${d.toISOString()} ${nivel} ${origen} ${recortar(mensaje)}\n`;
    let tamano = 0;
    try {
      tamano = statSync(ruta).size;
    } catch {
      /* el archivo de hoy todavía no existe */
    }
    if (tamano + Buffer.byteLength(linea) > config.tope) {
      llenos.add(nombre);
      appendFileSync(ruta, `${d.toISOString()} aviso registro ${LLENO}\n`, "utf8");
      return;
    }
    appendFileSync(ruta, linea, "utf8");
  } catch {
    /* sin registro: la app sigue igual */
  }
}

/** Borra los archivos de registro de más de `dias` días (por la fecha de su nombre). */
export function limpiarRegistrosViejos(dias = 7): void {
  try {
    const hoy = config.ahora();
    const corte = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias);
    const dir = carpeta();
    for (const f of readdirSync(dir)) {
      const m = ARCHIVO.exec(f);
      if (m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) < corte) rmSync(join(dir, f), { force: true });
    }
  } catch {
    /* sin carpeta de registros: nada que limpiar */
  }
}

/** Las últimas `n` líneas del registro (de los archivos más recientes hacia atrás), en orden. */
export function leerUltimas(n: number): string[] {
  try {
    const dir = carpeta();
    const archivos = readdirSync(dir).filter((f) => ARCHIVO.test(f)).sort().reverse();
    const salida: string[] = [];
    for (const f of archivos) {
      const lineas = readFileSync(join(dir, f), "utf8").split(/\r?\n/).filter(Boolean);
      salida.unshift(...lineas.slice(-(n - salida.length)));
      if (salida.length >= n) break;
    }
    return salida;
  } catch {
    return [];
  }
}
