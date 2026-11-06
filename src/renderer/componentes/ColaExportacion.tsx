import { CircleAlert, CircleCheck, Cpu, FolderOpen, X } from "lucide-react";
import type { Tarea } from "@shared/tipos";

interface Props {
  proyectoId: string;
  tareas: Tarea[];
  alCancelar(id: string): void;
  alAbrirCarpeta(): void;
}

/** Panel de exportaciones del proyecto: lo que se está exportando, lo que queda y el resultado. */
export function ColaExportacion({ proyectoId, tareas, alCancelar, alAbrirCarpeta }: Props) {
  const propias = tareas.filter((t) => t.tipo === "exportar" && t.proyectoId === proyectoId);
  if (propias.length === 0) return null;
  const actual = propias.find((t) => t.estado === "corriendo");
  const enCola = propias.filter((t) => t.estado === "pendiente").length;
  const listos = propias.filter((t) => t.estado === "ok").length;
  const errores = propias.filter((t) => t.estado === "error");

  return (
    <div className="cola-exportacion" aria-label="Exportaciones">
      {actual || enCola > 0 ? (
        <>
          <div className="cola-fila">
            <Cpu size={14} aria-hidden="true" />
            <b>Exportando</b>
            <span className="cola-titulo">{actual ? `«${actual.instantanea?.titulo ?? "reel"}» · ${actual.formato}` : "En espera…"}</span>
            {actual && (
              <button type="button" className="btn pequeno fantasma" aria-label="Cancelar exportación" onClick={() => alCancelar(actual.id)}><X size={13} aria-hidden="true" /></button>
            )}
          </div>
          <div className="barra"><i style={{ width: `${Math.round(actual?.pct ?? 0)}%` }} /></div>
          <div className="cola-fila tenue"><span className="mono">{Math.round(actual?.pct ?? 0)} %</span><span className="espacio" />{enCola > 0 && <span>{enCola} en cola</span>}</div>
        </>
      ) : (
        <div className="cola-fila">
          <CircleCheck size={14} className="ok-icono" aria-hidden="true" />
          <b>{listos === 1 ? "1 reel listo" : `${listos} reels listos`}</b>
          <span className="espacio" />
          <button type="button" className="btn pequeno" onClick={alAbrirCarpeta}><FolderOpen size={13} aria-hidden="true" />Abrir carpeta</button>
        </div>
      )}
      {errores.map((t) => (
        <p key={t.id} className="cola-error"><CircleAlert size={13} aria-hidden="true" />{t.error}</p>
      ))}
    </div>
  );
}
