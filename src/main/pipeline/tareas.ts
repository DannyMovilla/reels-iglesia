import type { EstadoProyecto, NombrePaso, TipoTarea } from "@shared/tipos";
import type { ContextoTarea, Ejecutor } from "../cola/cola";
import { ejecutarConProgreso } from "../procesos/lineas";
import { guardarProyecto, leerProyecto } from "../proyectos/almacen";
import { carpetaProyecto } from "../rutas";

export interface DepsPipeline {
  python: string;
  script: string;
  analizar(proyectoId: string, ctx: ContextoTarea): Promise<void>;
  encolar(proyectoId: string, tipo: TipoTarea): void;
  ejecutar?: typeof ejecutarConProgreso;
}

const PASO: Record<TipoTarea, NombrePaso> = { transcribir: "transcripcion", caras: "caras", analizar: "analisis" };
const ESTADO: Record<TipoTarea, EstadoProyecto> = { transcribir: "transcribiendo", caras: "caras", analizar: "analizando" };
const SIGUIENTE: Partial<Record<TipoTarea, TipoTarea>> = { transcribir: "caras", caras: "analizar" };

/** Envuelve cada paso: marca el estado del proyecto, mide el tiempo y encola el paso siguiente. */
export function crearEjecutores(deps: DepsPipeline): Record<TipoTarea, Ejecutor> {
  const ejecutar = deps.ejecutar ?? ejecutarConProgreso;

  async function python(proyectoId: string, modo: "--solo-transcripcion" | "--solo-caras", ctx: ContextoTarea): Promise<void> {
    const p = await leerProyecto(proyectoId);
    const args = [
      deps.script, p.video.ruta, "--inicio", String(p.rango.inicio), "--fin", String(p.rango.fin),
      modo, "--salida", carpetaProyecto(proyectoId), "--progreso-json",
    ];
    if (process.env.REELS_WHISPER_MODELO) args.push("--modelo", process.env.REELS_WHISPER_MODELO);
    const r = await ejecutar(deps.python, args, { alProgreso: (x) => ctx.alProgreso(x.pct, x.texto), senal: ctx.senal });
    if (r.codigo !== 0) {
      const err = new Error(r.stderr.trim().split(/\r?\n/).slice(-5).join("\n") || `El proceso terminó con código ${r.codigo}.`);
      throw err;
    }
  }

  const envolver = (tipo: TipoTarea, trabajo: (proyectoId: string, ctx: ContextoTarea) => Promise<void>): Ejecutor =>
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

  return {
    transcribir: envolver("transcribir", (id, ctx) => python(id, "--solo-transcripcion", ctx)),
    caras: envolver("caras", (id, ctx) => python(id, "--solo-caras", ctx)),
    analizar: envolver("analizar", deps.analizar),
  };
}
