import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Creacion } from "@shared/tipos";
import { escribirAtomico } from "../proyectos/almacen";
import { carpetaDatos } from "../rutas";

export const carpetaIa = (): string => join(carpetaDatos(), "ia");
export const carpetaCreacion = (id: string): string => join(carpetaIa(), id);

const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "versiculo";
const fecha = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Creación nueva (vacía hasta que Claude la escriba), con su carpeta en <datos>/ia/<id>/. */
export async function crearCreacion(entrada: Creacion["entrada"], ahora: Date = new Date()): Promise<Creacion> {
  const base = `${fecha(ahora)}-${slug(entrada.texto)}`;
  let id = base;
  for (let n = 2; existsSync(carpetaCreacion(id)); n++) id = `${base}-${n}`;
  const c: Creacion = {
    id, creado: ahora.toISOString(), entrada: { ...entrada },
    versiculo: { ref: "", texto: "", confirmado: false },
    gancho: "", reflexion: "", palabrasClave: [],
    musica: { modo: "auto", pista: null, animo: "esperanza", tonalidad: "Re", volumen: 0.18 },
    subtitulos: { estilo: "pop" },
    fondo: { tipo: "escena", escena: "luz" },
    redes: { instagram: { texto: "", hashtags: [] }, tiktok: { texto: "", hashtags: [] }, facebook: { texto: "" }, youtube: { titulo: "", texto: "" } },
    formatos: ["9:16", "4:5"],
    estado: "borrador",
  };
  await mkdir(join(carpetaCreacion(id), "exportados"), { recursive: true });
  await guardarCreacion(c);
  return c;
}

export async function guardarCreacion(c: Creacion): Promise<void> {
  await escribirAtomico(join(carpetaCreacion(c.id), "creacion.json"), c);
}

export async function leerCreacion(id: string): Promise<Creacion> {
  return JSON.parse(await readFile(join(carpetaCreacion(id), "creacion.json"), "utf8")) as Creacion;
}

/** Todas las creaciones, la más nueva primero (las que no se pueden leer se saltan). */
export async function listarCreaciones(): Promise<Creacion[]> {
  if (!existsSync(carpetaIa())) return [];
  const lista: Creacion[] = [];
  for (const id of await readdir(carpetaIa())) {
    try {
      lista.push(await leerCreacion(id));
    } catch {
      /* creación dañada o carpeta ajena */
    }
  }
  return lista.sort((a, b) => b.creado.localeCompare(a.creado));
}

const EXT_FONDO = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".m4v", ".webm"];

/** Copia la foto o el video de fondo a la carpeta de la creación y devuelve su ruta. */
export async function copiarFondo(id: string, origen: string): Promise<string> {
  const ext = extname(origen).toLowerCase();
  if (!EXT_FONDO.includes(ext)) throw new Error("El fondo tiene que ser una foto o un video (JPG, PNG, WEBP, MP4, MOV o WEBM).");
  for (const e of EXT_FONDO) await rm(join(carpetaCreacion(id), `fondo${e}`), { force: true });
  const destino = join(carpetaCreacion(id), `fondo${ext}`);
  await copyFile(origen, destino);
  return destino;
}

export async function borrarCreacion(id: string): Promise<void> {
  await rm(carpetaCreacion(id), { recursive: true, force: true });
}
