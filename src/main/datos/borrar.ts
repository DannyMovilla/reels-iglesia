import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { validarIdProyecto } from "../entregas/entregas";
import { slugTitulo, textosNombre } from "../exportar/tarea";
import { carpetaCreacion, guardarCreacion, leerCreacion } from "../ia/almacen";
import { guardarJson, leerClips } from "../proyectos/almacen";
import { registrar } from "../registro";
import { carpetaDatos, carpetaProyecto } from "../rutas";
import { tamanoCarpeta } from "./espacio";

/** Manda una ruta a la Papelera de Windows (en la app: `shell.trashItem`). */
export type Papelera = (ruta: string) => Promise<void>;
interface Deps { papelera: Papelera; ocupado: (id: string) => boolean }

const OCUPADA = "Espera a que termine lo que está haciendo esta prédica.";
const NO_PAPELERA = "No pude mandar la prédica a la Papelera. Cierra los programas que tengan abiertos sus archivos y prueba de nuevo.";
const NO_PAPELERA_REEL = "No pude mandar el reel a la Papelera. Ciérralo si está abierto en otro programa y prueba de nuevo.";

/** ¿La ruta queda dentro de la carpeta de datos de la app? */
export function dentroDeDatos(ruta: string): boolean {
  const r = relative(carpetaDatos(), ruta);
  return !!r && !r.startsWith("..") && !isAbsolute(r);
}

const mp4sDe = async (dir: string) => (existsSync(dir) ? (await readdir(dir)).filter((f) => /\.mp4$/i.test(f)) : []);

/** Lo que se va al borrar una prédica: clips, reels exportados y espacio. */
export async function resumenBorrado(id: string): Promise<{ clips: number; reels: number; bytes: number }> {
  validarIdProyecto(id);
  return {
    clips: (await leerClips(id)).length,
    reels: (await mp4sDe(join(carpetaProyecto(id), "exportados"))).length,
    bytes: await tamanoCarpeta(carpetaProyecto(id)),
  };
}

/** Manda la carpeta de la prédica a la Papelera (el video original del culto está fuera y no se toca). */
export async function borrarProyecto(id: string, d: Deps): Promise<void> {
  validarIdProyecto(id);
  const ruta = carpetaProyecto(id);
  if (!dentroDeDatos(ruta)) throw new Error("Proyecto no válido.");
  if (d.ocupado(id)) throw new Error(OCUPADA);
  try {
    await d.papelera(ruta);
  } catch (e) {
    registrar("error", "borrar", `prédica ${id}: ${e instanceof Error ? e.message : String(e)}`);
    throw new Error(NO_PAPELERA);
  }
  registrar("info", "borrar", `prédica ${id} a la Papelera`);
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Manda reels a la Papelera (el MP4, su portada y su archivo de textos si ningún reel restante lo comparte). `proyectoId`
 * puede ser `ia:<id>`. Después, cada clip exportado sin reels restantes vuelve a «editado» (y una creación de Con IA sin
 * reels, a «borrador»).
 */
export async function borrarReels(proyectoId: string, mp4s: string[] | "todos", d: Deps): Promise<{ bytes: number }> {
  const esIa = proyectoId.startsWith("ia:");
  if (!esIa) validarIdProyecto(proyectoId);
  const dir = join(esIa ? carpetaCreacion(proyectoId.slice(3)) : carpetaProyecto(proyectoId), "exportados");
  if (!dentroDeDatos(dir)) throw new Error("Proyecto no válido.");
  if (d.ocupado(proyectoId)) throw new Error(OCUPADA);
  const lista = mp4s === "todos" ? await mp4sDe(dir) : mp4s;
  if (lista.some((f) => typeof f !== "string" || /[\\/]|\.\./.test(f) || !/\.mp4$/i.test(f))) throw new Error("Archivo no válido.");

  let bytes = 0;
  // Un archivo que no se puede mover no frena a los demás: al final se ponen al día los clips y recién ahí se avisa.
  let fallos = 0;
  const mover = async (f: string) => {
    const ruta = join(dir, f);
    if (!existsSync(ruta)) return;
    const tamano = await stat(ruta).then((s) => s.size).catch(() => 0);
    try {
      await d.papelera(ruta);
      bytes += tamano;
    } catch (e) {
      fallos++;
      registrar("error", "borrar", `${f}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  for (const f of lista) {
    await mover(f);
    await mover(f.replace(/\.mp4$/i, "-portada.jpg"));
  }
  const quedan = await mp4sDe(dir);
  for (const txt of new Set(lista.map(textosNombre))) {
    if (txt.endsWith(".txt") && !quedan.some((m) => textosNombre(m) === txt)) await mover(txt);
  }
  registrar("info", "borrar", `${lista.length} reels de ${proyectoId} a la Papelera`);

  if (esIa) {
    const id = proyectoId.slice(3);
    const c = await leerCreacion(id);
    if (!quedan.length && c.estado === "exportado") await guardarCreacion({ ...c, estado: "borrador" });
    if (fallos) throw new Error(NO_PAPELERA_REEL);
    return { bytes };
  }
  const clips = await leerClips(proyectoId);
  const nuevos = clips.map((c) => {
    if (c.estado !== "exportado") return c;
    const patron = new RegExp(`^${escapar(slugTitulo(c.titulo))}(-\\d+)?-(9x16|4x5|1x1)\\.mp4$`, "i");
    const suyos = c.exportados ? c.exportados.filter((f) => quedan.includes(f)) : quedan.filter((f) => patron.test(f));
    return { ...c, ...(c.exportados ? { exportados: suyos } : {}), ...(suyos.length ? {} : { estado: "editado" as const }) };
  });
  await guardarJson(proyectoId, "clips.json", nuevos);
  if (fallos) throw new Error(NO_PAPELERA_REEL);
  return { bytes };
}
