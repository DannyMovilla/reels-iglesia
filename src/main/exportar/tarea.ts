import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { construirComposicion } from "@shared/reel/composicion";
import type { Caras, ClipSpec, Formato, Transcripcion } from "@shared/tipos";
import type { Ejecutor } from "../cola/cola";
import { dimensionesVideo, hayNvenc } from "../procesos/video";
import { guardarJson, leerJson, leerMarca, leerProyecto } from "../proyectos/almacen";
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
}

/** Ejecutor de la cola para "exportar": arma la composición desde la instantánea del clip y la renderiza. */
export function crearEjecutorExportar(deps: DepsExportar = {}): Ejecutor {
  const gpu = deps.gpu ?? (() => hayNvenc());
  const dimensiones = deps.dimensiones ?? ((r: string) => dimensionesVideo(r));
  const renderizar = deps.renderizar ?? renderizarReal;

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
    const comp = construirComposicion({
      clip, transcripcion, formato,
      caras: await leerJson<Caras>(t.proyectoId, "caras.json"),
      marca: await leerMarca(),
      dimensiones: await dimensiones(proyecto.video.ruta),
      fuenteVideo: proyecto.video.ruta.replace(/\\/g, "/"),
      recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes" },
      modo: "render",
    });
    const carpeta = carpetaProyecto(t.proyectoId);
    const tmp = join(carpeta, "tmp", t.id);
    const exportados = join(carpeta, "exportados");
    try {
      await prepararCarpeta(tmp, comp.html);
      const existentes = new Set(existsSync(exportados) ? await readdir(exportados) : []);
      const nombre = nombreSalida(clip.titulo, formato, existentes);
      await renderizar(tmp, join(exportados, nombre), {
        gpu: await gpu(),
        senal: ctx.senal,
        alProgreso: (pct) => ctx.alProgreso(Math.max(2, Math.min(99, pct)), nombre),
      });
      const clips = (await leerJson<ClipSpec[]>(t.proyectoId, "clips.json")) ?? [];
      await guardarJson(t.proyectoId, "clips.json", clips.map((c) => (c.id === clip.id ? { ...c, estado: "exportado" } : c)));
      ctx.alProgreso(100, nombre);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  };
}
