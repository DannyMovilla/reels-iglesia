import { Notification } from "electron";
import type { Tarea } from "@shared/tipos";
import type { Cola } from "../cola/cola";

export interface AvisoExportacion { proyectoId: string; listos: number; fallidos: number }

const ACTIVAS = new Set(["pendiente", "corriendo"]);

/** Recuerda qué exportaciones vio en curso por proyecto y avisa cuando ya no queda ninguna (una vez por tanda). */
export class AvisadorExportaciones {
  private tanda = new Map<string, Set<string>>();

  cambio(tareas: Tarea[]): AvisoExportacion[] {
    const exportar = tareas.filter((t) => t.tipo === "exportar");
    for (const t of exportar) if (ACTIVAS.has(t.estado)) {
      if (!this.tanda.has(t.proyectoId)) this.tanda.set(t.proyectoId, new Set());
      this.tanda.get(t.proyectoId)!.add(t.id);
    }
    const avisos: AvisoExportacion[] = [];
    for (const [proyectoId, ids] of this.tanda) {
      const propias = exportar.filter((t) => ids.has(t.id));
      if (propias.some((t) => ACTIVAS.has(t.estado))) continue;
      avisos.push({ proyectoId, listos: propias.filter((t) => t.estado === "ok").length, fallidos: propias.filter((t) => t.estado === "error").length });
      this.tanda.delete(proyectoId);
    }
    return avisos;
  }
}

/** Notificación de Windows al terminar las exportaciones de un proyecto. */
export function avisarExportaciones(cola: Cola): void {
  const avisador = new AvisadorExportaciones();
  avisador.cambio(cola.lista());
  cola.on("cambio", (tareas: Tarea[]) => {
    for (const a of avisador.cambio(tareas)) {
      if (!Notification.isSupported()) continue;
      const titulo = a.listos === 1 ? "1 reel listo" : `${a.listos} reels listos`;
      new Notification({ title: titulo, body: a.fallidos ? `${a.fallidos} no se pudieron exportar. Revisa la cola.` : "Ya están en la carpeta de exportados." }).show();
    }
  });
}
