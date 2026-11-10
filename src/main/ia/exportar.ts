import { existsSync } from "node:fs";
import { copyFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { construirReelVersiculo } from "@shared/reel/versiculo-reel";
import type { Creacion } from "@shared/tipos";
import type { Ejecutor } from "../cola/cola";
import { normalizarAudio } from "../exportar/mezcla";
import { prepararCarpeta } from "../exportar/preparar";
import { renderizar as renderizarReal, type OpcionesRender } from "../exportar/render";
import { argsPortada, nombreSalida, textosDelClip, textosNombre } from "../exportar/tarea";
import { musicaEn } from "../musica/banco";
import { ejecutarConProgreso } from "../procesos/lineas";
import { duracionVideo as duracionVideoReal, hayNvenc } from "../procesos/video";
import { leerMarca } from "../proyectos/almacen";
import { rutaEscenas, rutaPinturas } from "../rutas";
import { PINTURAS } from "@shared/reel/pinturas";
import { carpetaCreacion, guardarCreacion, leerCreacion } from "./almacen";

export interface DepsExportarIa {
  gpu?: () => Promise<boolean>;
  renderizar?: (dir: string, salida: string, op: OpcionesRender) => Promise<void>;
  normalizar?: (mp4: string, senal: AbortSignal) => Promise<void>;
  portada?: (mp4: string, t: number, salida: string) => Promise<void>;
  musica?: (c: Creacion, duracion: number) => Promise<string | null>;
  duracionVideo?: (ruta: string) => Promise<number>;
}

/** Ejecutor de la cola para "exportar-ia": el reel de un versículo de «Con IA». */
export function crearEjecutorExportarIa(deps: DepsExportarIa = {}): Ejecutor {
  const gpu = deps.gpu ?? (() => hayNvenc());
  const renderizar = deps.renderizar ?? renderizarReal;
  const normalizar = deps.normalizar ?? ((mp4: string, senal: AbortSignal) => normalizarAudio(mp4, senal));
  const portada = deps.portada ?? (async (mp4: string, t: number, salida: string) => {
    const r = await ejecutarConProgreso("ffmpeg", argsPortada(mp4, t, salida));
    if (r.codigo !== 0) throw new Error("No se pudo sacar la portada del reel.");
  });
  const elegirMusica = deps.musica ?? ((c: Creacion, d: number) => musicaEn(c.musica, carpetaCreacion(c.id), c.id, d));
  const duracionVideo = deps.duracionVideo ?? ((r: string) => duracionVideoReal(r));

  return async (t, ctx) => {
    if (!t.creacionId) throw new Error("La tarea no dice qué reel exportar.");
    // La versión que había al tocar Exportar (si la tarea la trae); si no, la guardada ahora.
    const c = t.instantaneaIa ?? (await leerCreacion(t.creacionId));
    const formato = t.formato ?? "9:16";
    if (!c.versiculo.texto.trim() || !c.versiculo.confirmado) throw new Error(`Confirma el texto de ${c.versiculo.ref || "el versículo"} antes de exportar.`);
    ctx.alProgreso(1, "Preparando…");

    const carpeta = carpetaCreacion(c.id);
    const tmp = join(carpeta, "tmp", t.id);
    const exportados = join(carpeta, "exportados");
    const extra: Record<string, string> = {};
    let fondoSrc: string | undefined, fondoDuracion: number | undefined;
    if ((c.fondo.tipo === "imagen" || c.fondo.tipo === "video") && c.fondo.archivo && existsSync(c.fondo.archivo)) {
      fondoSrc = `fondo${extname(c.fondo.archivo).toLowerCase()}`;
      extra[fondoSrc] = c.fondo.archivo;
      if (c.fondo.tipo === "video") fondoDuracion = await duracionVideo(c.fondo.archivo).catch(() => undefined);
    }
    if (c.fondo.tipo === "escena" || c.fondo.tipo === "pintura") extra["recursos/escenas/shaders.iife.js"] = join(rutaEscenas(), "shaders.iife.js");
    if (c.fondo.tipo === "pintura" && c.fondo.pintura && PINTURAS[c.fondo.pintura]) extra[`recursos/pinturas/${c.fondo.pintura}.jpg`] = join(rutaPinturas(), `${c.fondo.pintura}.jpg`);

    const marca = await leerMarca();
    const logo = marca.logo && existsSync(marca.logo) ? `recursos/logo${extname(marca.logo).toLowerCase()}` : undefined;
    if (logo && marca.logo) extra[logo] = marca.logo;
    const borrador = construirReelVersiculo({ creacion: c, marca, formato, modo: "render", recursos: { gsap: "", fuentes: "" } });
    // Si la música no se puede preparar, el reel sale igual, sin música.
    const pista = await elegirMusica(c, borrador.duracion).catch(() => null);
    const musica = pista ? `musica${extname(pista).toLowerCase()}` : undefined;
    if (pista && musica) extra[musica] = pista;

    const comp = construirReelVersiculo({
      creacion: c, marca, formato, modo: "render", fondoSrc, fondoDuracion,
      recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", logo, escenas: "recursos/escenas/shaders.iife.js", efectos: "recursos/efectos", pinturas: "recursos/pinturas" },
      musica: musica ? { src: musica } : undefined,
    });
    try {
      await prepararCarpeta(tmp, comp.html, extra);
      const existentes = new Set(existsSync(exportados) ? await readdir(exportados) : []);
      const nombre = nombreSalida(c.versiculo.ref || c.gancho, formato, existentes);
      const salida = join(exportados, nombre);
      await renderizar(tmp, salida, { gpu: await gpu(), senal: ctx.senal, alProgreso: (pct) => ctx.alProgreso(Math.max(2, Math.min(96, pct)), nombre) });
      ctx.alProgreso(97, "Ajustando el volumen…");
      await normalizar(salida, ctx.senal);
      ctx.alProgreso(99, "Portada…");
      await portada(salida, 1.2, salida.replace(/\.mp4$/i, "-portada.jpg"));
      await writeFile(join(exportados, textosNombre(nombre)), textosDelClip(c), "utf8");
      await guardarCreacion({ ...(await leerCreacion(c.id)), estado: "exportado" });
      ctx.alProgreso(100, nombre);
    } finally {
      await rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
      if (pista && pista.startsWith(join(carpeta, "tmp"))) await rm(pista, { force: true });
    }
  };
}
