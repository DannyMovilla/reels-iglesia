import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { aplicarEstiloAClip, completarClip, ESTILO_POR_DEFECTO } from "@shared/clip";
import { aplicarCorrecciones, type Correccion } from "@shared/correcciones";
import type { ClipSpec, Marca, Proyecto, Transcripcion, VideoOrigen } from "@shared/tipos";
import { validarRango } from "@shared/validar";
import { carpetaDatos, carpetaProyecto, carpetaProyectos } from "../rutas";

export type ArchivoProyecto = "transcripcion.json" | "caras.json" | "clips.json" | "correcciones.json" | "capitulos.json";

function slug(texto: string): string {
  return (
    texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) ||
    "predica"
  );
}

const fecha = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Escribe en un temporal propio y lo renombra. En Windows el rename falla con EPERM/EBUSY/EACCES si
 * otro proceso tiene el archivo abierto un instante (p. ej. la ventana leyendo el proyecto): se reintenta.
 */
export async function escribirAtomico(ruta: string, datos: unknown, ops: { renombrar?: (de: string, a: string) => Promise<void> } = {}): Promise<void> {
  const renombrar = ops.renombrar ?? rename;
  const tmp = `${ruta}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await writeFile(tmp, JSON.stringify(datos, null, 2), "utf8");
  for (let intento = 0; ; intento++) {
    try {
      await renombrar(tmp, ruta);
      return;
    } catch (e) {
      const codigo = (e as NodeJS.ErrnoException).code;
      if (intento >= 9 || !["EPERM", "EBUSY", "EACCES"].includes(codigo ?? "")) {
        await rm(tmp, { force: true });
        throw e;
      }
      await new Promise((r) => setTimeout(r, 20 * (intento + 1)));
    }
  }
}

export async function crearProyecto(
  datos: { nombre: string; video: VideoOrigen; rango: { inicio: number; fin: number }; predicador?: string },
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
    ...(datos.predicador ? { predicador: datos.predicador } : {}),
    estado: "nuevo",
    pasos: { transcripcion: { estado: "pendiente" }, audio: { estado: "pendiente" }, caras: { estado: "pendiente" }, analisis: { estado: "pendiente" } },
  };
  await mkdir(join(carpetaProyecto(id), "exportados"), { recursive: true });
  await mkdir(join(carpetaProyecto(id), "tmp"), { recursive: true });
  await guardarProyecto(proyecto);
  return proyecto;
}

/** "Ubicar el video": el mismo archivo (mismo tamaño) en otra ruta. */
export async function reubicarVideo(id: string, ruta: string): Promise<Proyecto> {
  const p = await leerProyecto(id);
  const st = await stat(ruta);
  if (st.size !== p.video.tamano) throw new Error("Ese archivo no es el mismo video del culto (tiene otro tamaño). Elige el video original.");
  p.video = { ...p.video, ruta, modificado: st.mtimeMs };
  await guardarProyecto(p);
  return leerProyecto(id);
}

export async function guardarProyecto(p: Proyecto): Promise<void> {
  const { videoDisponible: _omitido, ...guardable } = p;
  await escribirAtomico(join(carpetaProyecto(p.id), "proyecto.json"), guardable);
}

export async function leerProyecto(id: string): Promise<Proyecto> {
  const p = JSON.parse(await readFile(join(carpetaProyecto(id), "proyecto.json"), "utf8")) as Proyecto;
  p.pasos.audio ??= { estado: "pendiente" }; // proyectos de antes del plan 3
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

/** Correcciones de palabras que hizo la persona (se guardan aparte para no perderlas al volver a transcribir). */
export async function leerCorrecciones(id: string): Promise<Correccion[]> {
  const cs = await leerJson<Correccion[]>(id, "correcciones.json");
  return Array.isArray(cs) ? cs : [];
}

/** La transcripción con las correcciones de la persona: lo que usan subtítulos, clips, análisis y capítulos. */
export async function leerTranscripcion(id: string): Promise<Transcripcion | null> {
  const t = await leerJson<Transcripcion>(id, "transcripcion.json");
  return t ? aplicarCorrecciones(t, await leerCorrecciones(id)) : null;
}

export async function corregir(id: string, c: Correccion): Promise<Transcripcion> {
  await guardarJson(id, "correcciones.json", [...(await leerCorrecciones(id)), c]);
  const t = await leerTranscripcion(id);
  if (!t) throw new Error("No hay transcripción para corregir.");
  return t;
}

export async function quitarCorreccion(id: string, indice: number): Promise<Transcripcion> {
  await guardarJson(id, "correcciones.json", (await leerCorrecciones(id)).filter((_, i) => i !== indice));
  const t = await leerTranscripcion(id);
  if (!t) throw new Error("No hay transcripción.");
  return t;
}

export const MARCA_POR_DEFECTO: Marca = {
  nombre: "Mi iglesia", color: "#f2b544", invitacion: "Síguenos", logoEscala: 1, redes: {}, estilo: ESTILO_POR_DEFECTO,
};

/** Marca de la iglesia (marca.json en la carpeta de datos); lo que falte (marcas de versiones anteriores) va por defecto. */
export async function leerMarca(): Promise<Marca> {
  let guardada: Partial<Marca> = {};
  try {
    guardada = JSON.parse(await readFile(join(carpetaDatos(), "marca.json"), "utf8")) as Partial<Marca>;
  } catch {
    /* sin marca todavía */
  }
  const estilo = { ...ESTILO_POR_DEFECTO, ...(guardada.estilo ?? {}) };
  return structuredClone({ ...MARCA_POR_DEFECTO, ...guardada, redes: guardada.redes ?? {}, estilo });
}

export async function guardarMarca(m: Marca): Promise<void> {
  await mkdir(carpetaDatos(), { recursive: true });
  await escribirAtomico(join(carpetaDatos(), "marca.json"), m);
}

const EXT_LOGO = [".png", ".jpg", ".jpeg", ".svg", ".webp"];

/** Copia el logo elegido a <datos>/marca/logo.<ext> (borra el anterior) y devuelve su ruta. */
export async function copiarLogo(origen: string): Promise<string> {
  const ext = extname(origen).toLowerCase();
  if (!EXT_LOGO.includes(ext)) throw new Error("El logo tiene que ser una imagen PNG, JPG, SVG o WEBP.");
  const dir = join(carpetaDatos(), "marca");
  await mkdir(dir, { recursive: true });
  for (const e of EXT_LOGO) await rm(join(dir, `logo${e}`), { force: true });
  const destino = join(dir, `logo${ext}`);
  await copyFile(origen, destino);
  return destino;
}

/** "Aplicar a todos los clips": el estilo de la iglesia en los clips que aún no se exportaron. */
export async function aplicarEstilo(proyectoId: string): Promise<void> {
  const { estilo } = await leerMarca();
  const clips = await leerClips(proyectoId);
  await guardarJson(proyectoId, "clips.json", clips.map((c) => (c.estado === "exportado" ? c : aplicarEstiloAClip(c, estilo))));
}

/** clips.json completado al formato actual (clips de versiones anteriores incluidos). */
export async function leerClips(proyectoId: string): Promise<ClipSpec[]> {
  const clips = (await leerJson<unknown[]>(proyectoId, "clips.json")) ?? [];
  const { estilo } = await leerMarca();
  return clips.map((c) => completarClip(c, estilo));
}

/** Reemplaza un clip por id en clips.json (un clip que no existe se ignora). */
/** Agrega un clip nuevo (hecho a mano) a clips.json. */
export async function agregarClip(proyectoId: string, clip: ClipSpec): Promise<void> {
  await guardarJson(proyectoId, "clips.json", [...(await leerClips(proyectoId)), clip]);
}

export async function guardarClip(proyectoId: string, clip: ClipSpec): Promise<void> {
  const clips = (await leerJson<ClipSpec[]>(proyectoId, "clips.json")) ?? [];
  if (!clips.some((c) => c.id === clip.id)) return;
  // Una edición que llega después de exportar (guardado diferido) no le quita el estado "exportado".
  await guardarJson(proyectoId, "clips.json", clips.map((c) => (c.id === clip.id ? { ...clip, estado: c.estado === "exportado" ? "exportado" : clip.estado } : c)));
}

export interface ExportadosProyecto { proyectoId: string; nombre: string; archivos: { nombre: string; tamano: number; portada?: string }[] }

/** Los MP4 exportados de cada proyecto (los proyectos sin exportaciones no aparecen). */
export async function listarExportados(): Promise<ExportadosProyecto[]> {
  const salida: ExportadosProyecto[] = [];
  for (const p of await listarProyectos()) {
    const dir = join(carpetaProyecto(p.id), "exportados");
    if (!existsSync(dir)) continue;
    const todos = await readdir(dir);
    const archivos: ExportadosProyecto["archivos"] = [];
    for (const nombre of todos.filter((n) => n.toLowerCase().endsWith(".mp4")).sort()) {
      const portada = nombre.replace(/\.mp4$/i, "-portada.jpg");
      archivos.push({ nombre, tamano: (await stat(join(dir, nombre))).size, ...(todos.includes(portada) ? { portada } : {}) });
    }
    if (archivos.length) salida.push({ proyectoId: p.id, nombre: p.nombre, archivos });
  }
  return salida;
}
