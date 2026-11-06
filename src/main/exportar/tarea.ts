import { existsSync } from "node:fs";
import { copyFile, link, readdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { construirComposicion } from "@shared/reel/composicion";
import type { Caras, ClipSpec, Formato, Transcripcion } from "@shared/tipos";
import type { Ejecutor } from "../cola/cola";
import { dimensionesVideo, hayNvenc } from "../procesos/video";
import { guardarJson, leerClips, leerJson, leerMarca, leerProyecto } from "../proyectos/almacen";
import { carpetaProyecto } from "../rutas";
import { prepararCarpeta } from "./preparar";
import { renderizar as renderizarReal, type OpcionesRender } from "./render";

const SUFIJO: Record<Formato, string> = { "9:16": "9x16", "4:5": "4x5", "1:1": "1x1" };

/** "¿Oras o solo hablas? 🙏" + 9:16 → "oras-o-solo-hablas-9x16.mp4"; si ya existe, "-2", "-3"… */
export function nombreSalida(titulo: string, formato: Formato, existentes: Set<string>): string {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "reel";
  let nombre = `${base}-${SUFIJO[formato]}.mp4`;
  for (let i = 2; existentes.has(nombre); i++) nombre = `${base}-${i}-${SUFIJO[formato]}.mp4`;
  return nombre;
}

export interface DepsExportar {
  gpu?: () => Promise<boolean>;
  dimensiones?: (ruta: string) => Promise<{ ancho: number; alto: number }>;
  renderizar?: (dir: string, salida: string, op: OpcionesRender) => Promise<void>;
  borrar?: (dir: string) => Promise<void>;
}

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
    });
    const carpeta = carpetaProyecto(t.proyectoId);
    const tmp = join(carpeta, "tmp", t.id);
    const exportados = join(carpeta, "exportados");
    try {
      await prepararCarpeta(tmp, comp.html);
      if (logo && marca.logo) await copyFile(marca.logo, join(tmp, logo));
      if (enlazar) await link(proyecto.video.ruta, join(tmp, fuenteVideo)).catch(() => copyFile(proyecto.video.ruta, join(tmp, fuenteVideo)));
      const existentes = new Set(existsSync(exportados) ? await readdir(exportados) : []);
      const nombre = nombreSalida(clip.titulo, formato, existentes);
      await renderizar(tmp, join(exportados, nombre), {
        gpu: await gpu(),
        senal: ctx.senal,
        alProgreso: (pct) => ctx.alProgreso(Math.max(2, Math.min(99, pct)), nombre),
      });
      const clips = await leerClips(t.proyectoId);
      await guardarJson(t.proyectoId, "clips.json", clips.map((c) => (c.id === clip.id ? { ...c, estado: "exportado" } : c)));
      ctx.alProgreso(100, nombre);
    } finally {
      await borrarTemporal(tmp, borrar);
    }
  };
}
