import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { elegirPista, type Pista } from "@shared/reel/pistas";
import type { Animo, ClipSpec, Proyecto } from "@shared/tipos";
import { ejecutarConProgreso } from "../procesos/lineas";
import { duracionVideo } from "../procesos/video";
import { escribirAtomico } from "../proyectos/almacen";
import { carpetaDatos, carpetaProyecto, raizRecursos, rutaPython } from "../rutas";

export interface DepsMusica {
  duracion(ruta: string): Promise<number>;
  generarPad(duracion: number, tonalidad: string, animo: Animo, semilla: number, destino: string): Promise<void>;
}

const EXT_AUDIO = [".mp3", ".wav", ".m4a", ".ogg", ".flac"];
type Ficha = { animo: Animo; titulo: string; duracion: number };

export const carpetaMusica = (): string => join(carpetaDatos(), "musica");
const archivoFichas = () => join(carpetaMusica(), "musica.json");

async function leerFichas(): Promise<Record<string, Ficha>> {
  try {
    return JSON.parse(await readFile(archivoFichas(), "utf8")) as Record<string, Ficha>;
  } catch {
    return {};
  }
}

/** Las pistas propias de la iglesia (carpeta musica/), con su ánimo. */
export async function listarPistas(deps: DepsMusica = depsReales): Promise<Pista[]> {
  if (!existsSync(carpetaMusica())) return [];
  const fichas = await leerFichas();
  const archivos = (await readdir(carpetaMusica())).filter((a) => EXT_AUDIO.includes(extname(a).toLowerCase())).sort();
  let cambio = false;
  const pistas: Pista[] = [];
  for (const id of archivos) {
    let f = fichas[id];
    if (!f) {
      f = { animo: "reflexivo", titulo: basename(id, extname(id)), duracion: await deps.duracion(join(carpetaMusica(), id)).catch(() => 0) };
      fichas[id] = f;
      cambio = true;
    }
    pistas.push({ id, archivo: join(carpetaMusica(), id), titulo: f.titulo, autor: "", licencia: "", animo: f.animo, duracion: f.duracion, propia: true });
  }
  if (cambio) await escribirAtomico(archivoFichas(), fichas);
  return pistas;
}

/** Copia una pista de la persona a musica/ (sin pisar otra con el mismo nombre). */
export async function agregarPista(origen: string, deps: DepsMusica = depsReales): Promise<Pista> {
  const ext = extname(origen).toLowerCase();
  if (!EXT_AUDIO.includes(ext)) throw new Error("La pista tiene que ser un archivo de audio MP3, WAV, M4A, OGG o FLAC.");
  await mkdir(carpetaMusica(), { recursive: true });
  const base = basename(origen, extname(origen));
  let id = `${base}${ext}`;
  for (let n = 2; existsSync(join(carpetaMusica(), id)); n++) id = `${base} (${n})${ext}`;
  await copyFile(origen, join(carpetaMusica(), id));
  const fichas = await leerFichas();
  fichas[id] = { animo: "reflexivo", titulo: base, duracion: await deps.duracion(join(carpetaMusica(), id)).catch(() => 0) };
  await escribirAtomico(archivoFichas(), fichas);
  return (await listarPistas(deps)).find((p) => p.id === id)!;
}

export async function cambiarAnimo(id: string, animo: Animo): Promise<void> {
  const fichas = await leerFichas();
  if (!fichas[id]) return;
  fichas[id].animo = animo;
  await escribirAtomico(archivoFichas(), fichas);
}

/** Ids de las últimas pistas usadas en el proyecto (la primera, la más reciente). */
async function recientes(proyectoId: string): Promise<string[]> {
  try {
    return JSON.parse(await readFile(join(carpetaProyecto(proyectoId), "musica-usada.json"), "utf8")) as string[];
  } catch {
    return [];
  }
}

/**
 * Archivo de música para un reel según el modo del clip:
 * ninguna → null; pista → la elegida (si ya no existe, como auto); auto → pista del ánimo sin repetir
 * las últimas, o un pad si no hay; pad → pad generado en tmp/ con la duración del reel.
 */
export async function musicaParaClip(clip: ClipSpec, proyecto: Proyecto, duracion: number, deps: DepsMusica = depsReales): Promise<string | null> {
  const m = clip.musica;
  if (m.modo === "ninguna") return null;
  if (m.modo === "pista" || m.modo === "auto") {
    const pistas = await listarPistas(deps);
    const usadas = await recientes(proyecto.id);
    const elegida = (m.modo === "pista" ? pistas.find((p) => p.id === m.pista) : undefined) ?? elegirPista(m.animo, pistas, usadas, duracion);
    if (elegida) {
      await escribirAtomico(join(carpetaProyecto(proyecto.id), "musica-usada.json"), [elegida.id, ...usadas.filter((u) => u !== elegida.id)].slice(0, 10));
      return elegida.archivo;
    }
  }
  const dir = join(carpetaProyecto(proyecto.id), "tmp");
  await mkdir(dir, { recursive: true });
  const destino = join(dir, `pad-${clip.id}-${Date.now()}.wav`);
  const semilla = [...clip.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 100000, 7);
  await deps.generarPad(Math.floor(duracion) + 1, m.tonalidad, m.animo, semilla, destino);
  return destino;
}

/**
 * Música para la VISTA PREVIA: la misma elección que al exportar, pero sin contarla como usada.
 * Sin pista, un pad de 2 minutos guardado en <datos>/cache por ánimo y tonalidad (se genera una sola vez).
 */
export async function musicaParaVista(clip: ClipSpec, proyecto: Proyecto, duracion: number, deps: DepsMusica = depsReales): Promise<{ tipo: "musica" | "cache"; nombre: string } | null> {
  const m = clip.musica;
  if (m.modo === "ninguna") return null;
  if (m.modo === "pista" || m.modo === "auto") {
    const pistas = await listarPistas(deps);
    const elegida = (m.modo === "pista" ? pistas.find((p) => p.id === m.pista) : undefined) ?? elegirPista(m.animo, pistas, await recientes(proyecto.id), duracion);
    if (elegida) return { tipo: "musica", nombre: elegida.id };
  }
  const nombre = `pad-${m.animo}-${m.tonalidad}.wav`;
  const destino = join(carpetaDatos(), "cache", nombre);
  if (!existsSync(destino)) {
    await mkdir(join(carpetaDatos(), "cache"), { recursive: true });
    await deps.generarPad(Math.max(120, Math.ceil(duracion) + 1), m.tonalidad, m.animo, 7, destino);
  }
  return { tipo: "cache", nombre };
}

export const depsReales: DepsMusica = {
  duracion: (ruta) => duracionVideo(ruta),
  async generarPad(duracion, tonalidad, animo, semilla, destino) {
    const r = await ejecutarConProgreso(rutaPython(), [join(raizRecursos(), "python", "pads.py"), "--duracion", String(duracion), "--tonalidad", tonalidad,
      "--animo", animo, "--semilla", String(semilla), "--salida", destino], { env: { ...process.env, PYTHONUTF8: "1" } });
    if (r.codigo !== 0) throw new Error("No se pudo crear la música de fondo (pad).");
  },
};
