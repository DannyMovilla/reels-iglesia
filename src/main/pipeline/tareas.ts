import type { EstadoProyecto, NombrePaso, Tarea, TipoTarea } from "@shared/tipos";
import type { ContextoTarea, Ejecutor } from "../cola/cola";
import { ejecutarConProgreso } from "../procesos/lineas";
import { guardarProyecto, leerProyecto } from "../proyectos/almacen";
import { join } from "node:path";
import { argsVozLimpia, segundosDeProgreso } from "../procesos/audio";
import { crearVozSegura } from "../exportar/tarea";
import { carpetaProyecto } from "../rutas";

export interface DepsPipeline {
  python: string;
  script: string;
  analizar(proyectoId: string, ctx: ContextoTarea): Promise<void>;
  encolar(proyectoId: string, tipo: TipoTarea): void;
  ejecutar?: typeof ejecutarConProgreso;
}

type TipoPaso = Exclude<TipoTarea, "exportar">;
const PASO: Record<TipoPaso, NombrePaso> = { transcribir: "transcripcion", audio: "audio", caras: "caras", analizar: "analisis" };
const ESTADO: Record<TipoPaso, EstadoProyecto> = { transcribir: "transcribiendo", audio: "limpiando", caras: "caras", analizar: "analizando" };
const SIGUIENTE: Partial<Record<TipoPaso, TipoPaso>> = { transcribir: "audio", audio: "caras", caras: "analizar" };

/** Envuelve cada paso: marca el estado del proyecto, mide el tiempo y encola el paso siguiente. */
export function crearEjecutores(deps: DepsPipeline): Record<TipoPaso, Ejecutor> {
  const ejecutar = deps.ejecutar ?? ejecutarConProgreso;

  async function python(proyectoId: string, modo: "--solo-transcripcion" | "--solo-caras", ctx: ContextoTarea): Promise<void> {
    const p = await leerProyecto(proyectoId);
    const args = [
      deps.script, p.video.ruta, "--inicio", String(p.rango.inicio), "--fin", String(p.rango.fin),
      modo, "--salida", carpetaProyecto(proyectoId), "--progreso-json",
    ];
    if (process.env.REELS_WHISPER_MODELO) args.push("--modelo", process.env.REELS_WHISPER_MODELO);
    // En Windows Python escribe en cp1252 cuando la salida es una tubería: se fuerza UTF-8 para acentos, ñ y emojis.
    const env = { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" };
    let r;
    try {
      r = await ejecutar(deps.python, args, { env, alProgreso: (x) => ctx.alProgreso(x.pct, x.texto), senal: ctx.senal });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error("Falta preparar el entorno de Python de la app. Abre Ajustes.");
      throw e;
    }
    if (r.codigo !== 0) {
      throw new Error(r.stderr.trim().split(/\r?\n/).slice(-5).join("\n") || `El proceso terminó con código ${r.codigo}.`);
    }
  }

  const envolver = (tipo: TipoPaso, trabajo: (proyectoId: string, ctx: ContextoTarea) => Promise<void>): Ejecutor =>
    async (t, ctx) => {
      const paso = PASO[tipo];
      const p0 = await leerProyecto(t.proyectoId);
      p0.estado = ESTADO[tipo];
      await guardarProyecto(p0);
      const t0 = Date.now();
      try {
        await trabajo(t.proyectoId, ctx);
      } catch (e) {
        const p = await leerProyecto(t.proyectoId);
        p.pasos[paso] = { estado: "error", detalle: e instanceof Error ? e.message : String(e) };
        p.estado = "error";
        await guardarProyecto(p);
        throw e;
      }
      const p = await leerProyecto(t.proyectoId);
      p.pasos[paso] = { estado: "ok", segundos: Math.round((Date.now() - t0) / 1000) };
      const sig = SIGUIENTE[tipo];
      p.estado = sig ? ESTADO[sig] : "listo";
      await guardarProyecto(p);
      if (sig) deps.encolar(t.proyectoId, sig);
    };

  async function audio(proyectoId: string, ctx: ContextoTarea): Promise<void> {
    const p = await leerProyecto(proyectoId);
    const dur = p.rango.fin - p.rango.inicio;
    try {
      await crearVozSegura(join(carpetaProyecto(proyectoId), "voz.m4a"), async (tmp) => (await ejecutar("ffmpeg", argsVozLimpia(p.video.ruta, p.rango.inicio, p.rango.fin, tmp), {
        senal: ctx.senal,
        alLinea: (l) => {
          const s = segundosDeProgreso(l);
          if (s !== null) ctx.alProgreso(Math.min(99, (s / dur) * 100), "Limpiando el audio…");
        },
      })).codigo);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error("Falta FFmpeg. Abre Ajustes para instalarlo.");
      throw e;
    }
  }

  return {
    transcribir: envolver("transcribir", (id, ctx) => python(id, "--solo-transcripcion", ctx)),
    audio: envolver("audio", audio),
    caras: envolver("caras", (id, ctx) => python(id, "--solo-caras", ctx)),
    analizar: envolver("analizar", deps.analizar),
  };
}

/**
 * Al abrir la app: los proyectos cuyas tareas quedaron interrumpidas (se cerró la app a mitad)
 * pasan a "error" con un mensaje claro, para que no se vean "en curso" para siempre.
 */
export async function marcarInterrumpidos(tareas: Tarea[]): Promise<void> {
  for (const t of tareas) {
    if (t.estado !== "interrumpida" || t.tipo === "exportar") continue;
    try {
      const p = await leerProyecto(t.proyectoId);
      p.pasos[PASO[t.tipo]] = { estado: "error", detalle: "Se interrumpió al cerrar la app." };
      p.estado = "error";
      await guardarProyecto(p);
    } catch {
      /* el proyecto ya no existe */
    }
  }
}
