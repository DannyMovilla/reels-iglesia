import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { Tarea, TipoTarea } from "@shared/tipos";
import { escribirAtomico } from "../proyectos/almacen";

export type { Tarea, TipoTarea, EstadoTarea } from "@shared/tipos";

export interface ContextoTarea {
  alProgreso(pct: number, texto?: string): void;
  senal: AbortSignal;
}
export type Ejecutor = (t: Tarea, ctx: ContextoTarea) => Promise<void>;

/** Cola persistente: una tarea a la vez, en orden de llegada. Emite "cambio" con la lista. */
export class Cola extends EventEmitter {
  private tareas: Tarea[] = [];
  private actual: { id: string; ctl: AbortController } | null = null;
  private escritura: Promise<void> = Promise.resolve();

  constructor(private readonly archivoEstado: string, private readonly ejecutores: Record<TipoTarea, Ejecutor>) {
    super();
  }

  async cargar(): Promise<void> {
    if (existsSync(this.archivoEstado)) {
      try {
        const guardadas = JSON.parse(await readFile(this.archivoEstado, "utf8")) as Tarea[];
        this.tareas = guardadas.map((t) => (t.estado === "corriendo" || t.estado === "pendiente" ? { ...t, estado: "interrumpida" } : t));
      } catch {
        // Archivo dañado (p. ej. un corte de luz): se guarda aparte y la cola empieza vacía para que la app abra igual.
        await rename(this.archivoEstado, this.archivoEstado + ".bad").catch(() => undefined);
        this.tareas = [];
      }
    }
    this.cambio(true);
  }

  lista(): Tarea[] {
    return this.tareas.map((t) => ({ ...t }));
  }

  agregar(proyectoId: string, tipo: TipoTarea, extra: Pick<Tarea, "clipId" | "formato" | "instantanea"> = {}): Tarea {
    const t: Tarea = { id: randomUUID(), proyectoId, tipo, estado: "pendiente", pct: 0, creada: new Date().toISOString(), ...extra };
    this.tareas.push(t);
    this.cambio(true);
    this.siguiente();
    return { ...t };
  }

  reintentar(id: string): void {
    const t = this.tareas.find((x) => x.id === id);
    if (!t || !["error", "interrumpida", "cancelada"].includes(t.estado)) return;
    Object.assign(t, { estado: "pendiente", pct: 0, error: undefined, texto: undefined, iniciada: undefined, terminada: undefined });
    this.cambio(true);
    this.siguiente();
  }

  cancelar(id: string): void {
    if (this.actual?.id === id) return this.actual.ctl.abort();
    const t = this.tareas.find((x) => x.id === id);
    if (t?.estado === "pendiente") {
      t.estado = "cancelada";
      this.cambio(true);
    }
  }

  private siguiente(): void {
    if (this.actual) return;
    const t = this.tareas.find((x) => x.estado === "pendiente");
    if (!t) return;
    const ctl = new AbortController();
    this.actual = { id: t.id, ctl };
    Object.assign(t, { estado: "corriendo", iniciada: new Date().toISOString() });
    this.cambio(true);
    const ctx: ContextoTarea = {
      senal: ctl.signal,
      alProgreso: (pct, texto) => {
        t.pct = Math.max(0, Math.min(100, pct));
        if (texto !== undefined) t.texto = texto;
        this.cambio(false);
      },
    };
    Promise.resolve()
      .then(() => this.ejecutores[t.tipo]({ ...t }, ctx))
      .then(
        () => Object.assign(t, { estado: "ok", pct: 100 }),
        (e: unknown) =>
          ctl.signal.aborted
            ? Object.assign(t, { estado: "cancelada" })
            : Object.assign(t, { estado: "error", error: e instanceof Error ? e.message : String(e) }),
      )
      .finally(() => {
        t.terminada = new Date().toISOString();
        this.actual = null;
        this.cambio(true);
        this.siguiente();
      });
  }

  /** Avisa a quien escucha; guarda en disco solo en cambios de estado (no en cada % de progreso). */
  private cambio(guardar: boolean): void {
    this.emit("cambio", this.lista());
    if (!guardar) return;
    const datos = JSON.stringify(this.tareas, null, 2);
    this.escritura = this.escritura
      .then(async () => {
        await mkdir(dirname(this.archivoEstado), { recursive: true });
        await escribirAtomico(this.archivoEstado, JSON.parse(datos));
      })
      .catch(() => undefined);
  }
}
