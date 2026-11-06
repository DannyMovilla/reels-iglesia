import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Marca, Proyecto, VideoOrigen } from "@shared/tipos";
import { validarRango } from "@shared/validar";
import { carpetaDatos, carpetaProyecto, carpetaProyectos } from "../rutas";

export type ArchivoProyecto = "transcripcion.json" | "caras.json" | "clips.json";

function slug(texto: string): string {
  return (
    texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) ||
    "predica"
  );
}

const fecha = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function escribirAtomico(ruta: string, datos: unknown): Promise<void> {
  const tmp = ruta + ".tmp";
  await writeFile(tmp, JSON.stringify(datos, null, 2), "utf8");
  await rename(tmp, ruta);
}

export async function crearProyecto(
  datos: { nombre: string; video: VideoOrigen; rango: { inicio: number; fin: number } },
  ahora: Date = new Date(),
): Promise<Proyecto> {
  const error = validarRango(datos.rango.inicio, datos.rango.fin, datos.video.duracion);
  if (error) throw new Error(error);
  const base = `${fecha(ahora)}-${slug(datos.nombre)}`;
  let id = base;
  for (let n = 2; existsSync(carpetaProyecto(id)); n++) id = `${base}-${n}`;
  const proyecto: Proyecto = {
    id,
    nombre: datos.nombre,
    creado: ahora.toISOString(),
    video: datos.video,
    rango: datos.rango,
    estado: "nuevo",
    pasos: { transcripcion: { estado: "pendiente" }, caras: { estado: "pendiente" }, analisis: { estado: "pendiente" } },
  };
  await mkdir(join(carpetaProyecto(id), "exportados"), { recursive: true });
  await mkdir(join(carpetaProyecto(id), "tmp"), { recursive: true });
  await guardarProyecto(proyecto);
  return proyecto;
}

export async function guardarProyecto(p: Proyecto): Promise<void> {
  const { videoDisponible: _omitido, ...guardable } = p;
  await escribirAtomico(join(carpetaProyecto(p.id), "proyecto.json"), guardable);
}

export async function leerProyecto(id: string): Promise<Proyecto> {
  const p = JSON.parse(await readFile(join(carpetaProyecto(id), "proyecto.json"), "utf8")) as Proyecto;
  try {
    const st = await stat(p.video.ruta);
    p.videoDisponible = st.size === p.video.tamano;
  } catch {
    p.videoDisponible = false;
  }
  return p;
}

export async function listarProyectos(): Promise<Proyecto[]> {
  if (!existsSync(carpetaProyectos())) return [];
  const ids = await readdir(carpetaProyectos());
  const lista: Proyecto[] = [];
  for (const id of ids) {
    if (!existsSync(join(carpetaProyecto(id), "proyecto.json"))) continue;
    lista.push(await leerProyecto(id));
  }
  return lista.sort((a, b) => b.creado.localeCompare(a.creado));
}

export async function leerJson<T>(id: string, archivo: ArchivoProyecto): Promise<T | null> {
  try {
    return JSON.parse(await readFile(join(carpetaProyecto(id), archivo), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function guardarJson(id: string, archivo: ArchivoProyecto, datos: unknown): Promise<void> {
  await escribirAtomico(join(carpetaProyecto(id), archivo), datos);
}

export const MARCA_POR_DEFECTO: Marca = { nombre: "Mi iglesia", color: "#f2b544", invitacion: "Síguenos" };

/** Marca de la iglesia (marca.json en la carpeta de datos), con valores por defecto mientras no exista la pantalla Marca. */
export async function leerMarca(): Promise<Marca> {
  try {
    return { ...MARCA_POR_DEFECTO, ...(JSON.parse(await readFile(join(carpetaDatos(), "marca.json"), "utf8")) as Partial<Marca>) };
  } catch {
    return { ...MARCA_POR_DEFECTO };
  }
}
