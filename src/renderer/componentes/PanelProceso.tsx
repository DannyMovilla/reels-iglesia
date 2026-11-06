import { Check, CircleAlert, Circle, LoaderCircle, RotateCcw } from "lucide-react";
import type { NombrePaso, Proyecto, Tarea, TipoTarea } from "@shared/tipos";

const PASOS: { paso: NombrePaso; tipo: TipoTarea; titulo: string }[] = [
  { paso: "transcripcion", tipo: "transcribir", titulo: "Transcripción" },
  { paso: "caras", tipo: "caras", titulo: "Predicador detectado" },
  { paso: "analisis", tipo: "analizar", titulo: "Análisis con Claude" },
];

interface Props {
  proyecto: Proyecto;
  tareas: Tarea[];
  alReintentar(idTarea: string): void;
  /** Volver a procesar desde un paso que falló y ya no tiene tarea en la cola. */
  alProcesar(desde: TipoTarea): void;
}

export function PanelProceso({ proyecto, tareas, alReintentar, alProcesar }: Props) {
  return (
    <ol className="pasos" aria-label="Proceso">
      {PASOS.map(({ paso, tipo, titulo }) => {
        const p = proyecto.pasos[paso];
        const ultima = tareas.filter((t) => t.proyectoId === proyecto.id && t.tipo === tipo).at(-1);
        const corriendo = ultima?.estado === "corriendo" || ultima?.estado === "pendiente";
        const fallo = ultima && ["error", "interrumpida", "cancelada"].includes(ultima.estado);
        const estado = corriendo ? "corriendo" : fallo ? "error" : p.estado;
        return (
          <li key={paso} className={`paso ${estado}`}>
            <span className="punto" aria-hidden="true">
              {estado === "ok" ? <Check size={13} strokeWidth={2.6} /> : estado === "corriendo" ? <LoaderCircle size={14} className="girar" />
                : estado === "error" ? <CircleAlert size={14} /> : <Circle size={10} />}
            </span>
            <div className="paso-texto">
              <b>{titulo}</b>
              <span>
                {estado === "ok" && (p.segundos !== undefined ? `Listo en ${p.segundos < 60 ? `${p.segundos} s` : `${Math.round(p.segundos / 60)} min`}` : "Listo")}
                {estado === "corriendo" && (ultima?.estado === "pendiente" ? "En espera…" : `${Math.round(ultima?.pct ?? 0)}%${ultima?.texto ? ` · ${ultima.texto}` : ""}`)}
                {estado === "pendiente" && "Pendiente"}
                {estado === "error" && (ultima?.estado === "interrumpida" ? "Se interrumpió al cerrar la app." : ultima?.error ?? p.detalle ?? "Falló")}
              </span>
            </div>
            {estado === "error" && (
              <button type="button" className="btn pequeno" onClick={() => (fallo && ultima ? alReintentar(ultima.id) : alProcesar(tipo))}>
                <RotateCcw size={13} aria-hidden="true" />Reintentar
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
