import { existsSync } from "node:fs";
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { leerProyecto, listarProyectos } from "../proyectos/almacen";
import { carpetaProyecto } from "../rutas";
import { registrar } from "../registro";

/** Bytes de una carpeta (recursivo); 0 si no existe. */
export async function tamanoCarpeta(ruta: string): Promise<number> {
  let total = 0;
  let entradas;
  try {
    entradas = await readdir(ruta, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entradas) {
    const p = join(ruta, e.name);
    if (e.isDirectory()) total += await tamanoCarpeta(p);
    else total += await stat(p).then((s) => s.size).catch(() => 0);
  }
  return total;
}

const esVoz = (f: string) => /^voz(-[a-z]+)?\.m4a$/i.test(f);

/**
 * Borra lo que la app sabe rehacer de una prédica: tmp/ y las voces limpias (estas solo si el video original sigue
 * en su lugar: sin él no se podrían rehacer). Una prédica trabajando se salta.
 */
export async function liberarEspacio(id: string, d: { ocupado: (id: string) => boolean }): Promise<{ liberado: number; saltada: boolean }> {
  if (d.ocupado(id)) return { liberado: 0, saltada: true };
  const carpeta = carpetaProyecto(id);
  let liberado = 0;
  const tmp = join(carpeta, "tmp");
  if (existsSync(tmp)) {
    liberado += await tamanoCarpeta(tmp);
    await rm(tmp, { recursive: true, force: true });
  }
  if ((await leerProyecto(id)).videoDisponible) {
    for (const f of (await readdir(carpeta)).filter(esVoz)) {
      liberado += await stat(join(carpeta, f)).then((s) => s.size).catch(() => 0);
      await rm(join(carpeta, f), { force: true });
    }
  }
  if (liberado) registrar("info", "espacio", `liberé ${liberado} bytes de ${id}`);
  return { liberado, saltada: false };
}

/** «Liberar espacio» de todas las prédicas. */
export async function liberarTodo(d: { ocupado: (id: string) => boolean }): Promise<{ liberado: number; saltadas: number }> {
  let liberado = 0, saltadas = 0;
  for (const p of await listarProyectos()) {
    const r = await liberarEspacio(p.id, d);
    liberado += r.liberado;
    if (r.saltada) saltadas++;
  }
  return { liberado, saltadas };
}

/** Al abrir: borra lo que hay en tmp/ de cada prédica con más de `dias` días (salta las que están trabajando). */
export async function limpiarTmpViejos(dias = 7, ahora = Date.now(), ocupado: (id: string) => boolean = () => false): Promise<number> {
  let borrados = 0;
  for (const p of await listarProyectos().catch(() => [])) {
    if (ocupado(p.id)) continue;
    const tmp = join(carpetaProyecto(p.id), "tmp");
    let entradas: string[];
    try {
      entradas = await readdir(tmp);
    } catch {
      continue;
    }
    for (const e of entradas) {
      const ruta = join(tmp, e);
      const m = await stat(ruta).then((s) => s.mtimeMs).catch(() => ahora);
      if (ahora - m > dias * 864e5) {
        await rm(ruta, { recursive: true, force: true });
        borrados++;
      }
    }
  }
  return borrados;
}
