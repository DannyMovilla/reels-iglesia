import { existsSync } from "node:fs";
import { copyFile, link, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { construirComposicion } from "@shared/reel/composicion";
import { duracionReel, palabrasDe } from "@shared/reel/tiempo";
import type { Caras, ClipSpec, Formato, Proyecto, Redes, Transcripcion } from "@shared/tipos";
import { NOMBRE_RED, textoParaPublicar } from "@shared/redes";
import type { Ejecutor } from "../cola/cola";
import { argsVozLimpia } from "../procesos/audio";
import { ejecutarConProgreso } from "../procesos/lineas";
import { dimensionesVideo, hayNvenc } from "../procesos/video";
import { normalizarAudio } from "./mezcla";
import { musicaParaClip } from "../musica/banco";
import { guardarJson, leerClips, leerJson, leerMarca, leerProyecto } from "../proyectos/almacen";
import { carpetaProyecto } from "../rutas";
import { prepararCarpeta } from "./preparar";
import { renderizar as renderizarReal, type OpcionesRender } from "./render";

const SUFIJO: Record<Formato, string> = { "9:16": "9x16", "4:5": "4x5", "1:1": "1x1" };

/** "¿Oras o solo hablas? 🙏" + 9:16 → "oras-o-solo-hablas-9x16.mp4"; si ya existe, "-2", "-3"… */
export function nombreSalida(titulo: string, formato: Formato, existentes: Set<string>): string {
  const base = slugTitulo(titulo);
  let nombre = `${base}-${SUFIJO[formato]}.mp4`;
  for (let i = 2; existentes.has(nombre); i++) nombre = `${base}-${i}-${SUFIJO[formato]}.mp4`;
  return nombre;
}

/** "¿Oras o solo hablas? 🙏" → "oras-o-solo-hablas" (máx. 60 caracteres, sin guiones en los bordes). */
export function slugTitulo(titulo: string): string {
  return titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60).replace(/^-+|-+$/g, "") || "reel";
}

/** FFmpeg: un cuadro del reel en JPG de alta calidad (la portada). */
export const argsPortada = (mp4: string, t: number, salida: string): string[] =>
  ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", mp4, "-frames:v", "1", "-q:v", "2", salida];

/** Texto para pegar en cada red, en un solo archivo junto a los MP4. */
export function textosDelClip(c: ClipSpec): string {
  return (Object.keys(NOMBRE_RED) as (keyof Redes)[])
    .map((red) => `=== ${NOMBRE_RED[red]} ===\n${textoParaPublicar(c.redes, red)}\n`)
    .join("\n");
}

export interface DepsExportar {
  gpu?: () => Promise<boolean>;
  dimensiones?: (ruta: string) => Promise<{ ancho: number; alto: number }>;
  renderizar?: (dir: string, salida: string, op: OpcionesRender) => Promise<void>;
  borrar?: (dir: string) => Promise<void>;
  /** Deja el MP4 en −14 LUFS / −1 dBTP. */
  normalizar?: (mp4: string, senal: AbortSignal) => Promise<void>;
  /** Crea voz.m4a para un proyecto que no la tiene (proyectos de antes del plan 3). */
  crearVoz?: (p: Proyecto, destino: string, senal: AbortSignal) => Promise<void>;
  /** Archivo de música para el clip (pista o pad), o null para un reel sin música. */
  musica?: (clip: ClipSpec, proyecto: Proyecto, duracion: number) => Promise<string | null>;
  /** Saca la portada (un cuadro del MP4) en el segundo t. */
  portada?: (mp4: string, t: number, salida: string) => Promise<void>;
}

async function portadaReal(mp4: string, t: number, salida: string): Promise<void> {
  const r = await ejecutarConProgreso("ffmpeg", argsPortada(mp4, t, salida));
  if (r.codigo !== 0) throw new Error("No se pudo sacar la portada del reel.");
}

/** voz.m4a con FFmpeg (mismo filtro que el paso "audio" de la cola). */
async function crearVozReal(p: Proyecto, destino: string, senal: AbortSignal): Promise<void> {
  const r = await ejecutarConProgreso("ffmpeg", argsVozLimpia(p.video.ruta, p.rango.inicio, p.rango.fin, destino), { senal });
  if (r.codigo !== 0) throw new Error("No se pudo limpiar el audio de la prédica.");
}

/** Enlace duro (instantáneo, sin ocupar disco) o copia si está en otro disco. */
const enlazarOCopiar = (origen: string, destino: string) => link(origen, destino).catch(() => copyFile(origen, destino));

/**
 * Borra la carpeta temporal. En Windows el navegador del render puede tenerla ocupada (EBUSY) un rato
 * después de terminar: se reintenta y, si sigue ocupada, se deja (el reel ya está listo).
 */
async function borrarTemporal(dir: string, borrar: (dir: string) => Promise<void>): Promise<void> {
  for (let intento = 0; intento < 5; intento++) {
    try {
      await borrar(dir);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 30 * (intento + 1)));
    }
  }
}

/** Ejecutor de la cola para "exportar": arma la composición desde la instantánea del clip y la renderiza. */
export function crearEjecutorExportar(deps: DepsExportar = {}): Ejecutor {
  const gpu = deps.gpu ?? (() => hayNvenc());
  const dimensiones = deps.dimensiones ?? ((r: string) => dimensionesVideo(r));
  const renderizar = deps.renderizar ?? renderizarReal;
  const normalizar = deps.normalizar ?? ((mp4: string, senal: AbortSignal) => normalizarAudio(mp4, senal));
  const crearVoz = deps.crearVoz ?? crearVozReal;
  const portada = deps.portada ?? portadaReal;
  const elegirMusica = deps.musica ?? ((c: ClipSpec, p: Proyecto, d: number) => musicaParaClip(c, p, d));
  const borrar = deps.borrar ?? ((d: string) => rm(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

  return async (t, ctx) => {
    const clip = t.instantanea;
    const formato = t.formato ?? "9:16";
    if (!clip) throw new Error("La tarea no tiene el clip a exportar.");
    const proyecto = await leerProyecto(t.proyectoId);
    if (!proyecto.videoDisponible) throw new Error("No encuentro el video original. Vuelve a ponerlo en su lugar y reintenta.");
    const sinConfirmar = clip.versiculos.find((v) => v.activo && (!v.confirmado || !v.texto.trim()));
    if (sinConfirmar) throw new Error(`Confirma el texto de ${sinConfirmar.ref} antes de exportar.`);
    const transcripcion = await leerJson<Transcripcion>(t.proyectoId, "transcripcion.json");
    if (!transcripcion) throw new Error("No hay transcripción para este proyecto. Vuelve a procesar la prédica.");

    ctx.alProgreso(1, "Preparando…");
    // HyperFrames corta el src en "#" o "?": esas rutas van como un enlace dentro de la carpeta temporal.
    const enlazar = /[#?%]/.test(proyecto.video.ruta);
    const fuenteVideo = enlazar ? `video${extname(proyecto.video.ruta).toLowerCase()}` : proyecto.video.ruta.replace(/\\/g, "/");
    const carpeta = carpetaProyecto(t.proyectoId);
    const voz = join(carpeta, "voz.m4a");
    if (!existsSync(voz)) await crearVoz(proyecto, voz, ctx.senal);
    const pista = await elegirMusica(clip, proyecto, duracionReel(clip, palabrasDe(transcripcion)));
    const musica = pista ? `musica${extname(pista).toLowerCase()}` : undefined;
    const marca = await leerMarca();
    const logo = marca.logo && existsSync(marca.logo) ? `recursos/logo${extname(marca.logo).toLowerCase()}` : undefined;
    const comp = construirComposicion({
      clip, transcripcion, formato,
      caras: await leerJson<Caras>(t.proyectoId, "caras.json"),
      marca,
      dimensiones: await dimensiones(proyecto.video.ruta),
      fuenteVideo,
      recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", logo },
      modo: "render",
      voz: { src: "voz.m4a", inicioRango: proyecto.rango.inicio },
      predicador: proyecto.predicador ?? marca.predicador,
      musica: musica ? { src: musica } : undefined,
    });
    const tmp = join(carpeta, "tmp", t.id);
    const exportados = join(carpeta, "exportados");
    try {
      await prepararCarpeta(tmp, comp.html);
      if (logo && marca.logo) await copyFile(marca.logo, join(tmp, logo));
      await enlazarOCopiar(voz, join(tmp, "voz.m4a"));
      if (pista && musica) await copyFile(pista, join(tmp, musica));
      if (enlazar) await enlazarOCopiar(proyecto.video.ruta, join(tmp, fuenteVideo));
      const existentes = new Set(existsSync(exportados) ? await readdir(exportados) : []);
      const nombre = nombreSalida(clip.titulo, formato, existentes);
      const salida = join(exportados, nombre);
      await renderizar(tmp, salida, {
        gpu: await gpu(),
        senal: ctx.senal,
        alProgreso: (pct) => ctx.alProgreso(Math.max(2, Math.min(96, pct)), nombre),
      });
      ctx.alProgreso(97, "Ajustando el volumen…");
      await normalizar(salida, ctx.senal);
      ctx.alProgreso(99, "Portada…");
      // Portada: con el gancho a la vista (mitad de su entrada, como mucho 1,2 s).
      const durGancho = clip.apertura?.activa ? clip.apertura.fin - clip.apertura.inicio : Math.min(4.5, clip.fin - clip.inicio);
      await portada(salida, clip.gancho.trim() ? Math.min(1.2, durGancho / 2) : 1.2, salida.replace(/\.mp4$/i, "-portada.jpg"));
      await writeFile(join(exportados, `${slugTitulo(clip.titulo)}-textos.txt`), textosDelClip(clip), "utf8");
      const clips = await leerClips(t.proyectoId);
      await guardarJson(t.proyectoId, "clips.json", clips.map((c) => (c.id === clip.id ? { ...c, estado: "exportado" } : c)));
      ctx.alProgreso(100, nombre);
    } finally {
      await borrarTemporal(tmp, borrar);
      if (pista && pista.startsWith(join(carpeta, "tmp"))) await rm(pista, { force: true }); // pad generado para este reel
    }
  };
}
