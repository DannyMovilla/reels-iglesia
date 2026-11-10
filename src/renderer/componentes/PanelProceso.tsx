import { useState } from "react";
import { Check, ChevronDown, CircleAlert, Circle, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import type { Analisis, NombrePaso, Proyecto, Tarea, TipoTarea } from "@shared/tipos";
import { limpiarAnalisis, OpcionesAnalisis } from "./OpcionesAnalisis";

const PASOS: { paso: NombrePaso; tipo: TipoTarea; titulo: string }[] = [
  { paso: "transcripcion", tipo: "transcribir", titulo: "Transcripción" },
  { paso: "audio", tipo: "audio", titulo: "Audio limpio" },
  { paso: "caras", tipo: "caras", titulo: "Predicador detectado" },
  { paso: "analisis", tipo: "analizar", titulo: "Análisis con Claude" },
];

interface Props {
  proyecto: Proyecto;
  tareas: Tarea[];
  alReintentar(idTarea: string): void;
  /** Volver a procesar desde un paso que falló y ya no tiene tarea en la cola. */
  alProcesar(desde: TipoTarea): void;
  /** "Analizar de nuevo" con otra instrucción o duración. */
  alReanalizar?(a: Analisis): void;
}

export function PanelProceso({ proyecto, tareas, alReintentar, alProcesar, alReanalizar }: Props) {
  const [reanalizando, setReanalizando] = useState<Analisis | null>(null);
  const analizando = tareas.some((t) => t.proyectoId === proyecto.id && t.tipo === "analizar" && (t.estado === "pendiente" || t.estado === "corriendo"));
  const puedeReanalizar = alReanalizar && proyecto.pasos.analisis?.estado === "ok" && !analizando;
  const ocupado = tareas.some((t) => t.proyectoId === proyecto.id && (t.estado === "pendiente" || t.estado === "corriendo"));
  // Con todo listo, el proceso se resume en una línea (se puede abrir para ver los tiempos).
  const terminado = !ocupado && PASOS.every(({ paso }) => proyecto.pasos[paso]?.estado === "ok");
  const [abierto, setAbierto] = useState(false);
  const compacto = terminado && !abierto;
  return (
    <>
    {!terminado && <div className="titulo-seccion">Proceso</div>}
    {terminado && (
      <button type="button" className="proceso-resumen" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        <span className="punto" aria-hidden="true"><Check size={13} strokeWidth={2.6} /></span>
        <span>Prédica lista <span className="tenue">· {PASOS.length} de {PASOS.length} pasos</span></span>
        <ChevronDown size={15} className="flecha" aria-hidden="true" />
      </button>
    )}
    <ol className={`pasos${compacto ? " compacta" : ""}`} aria-label="Proceso">
      {PASOS.map(({ paso, tipo, titulo }) => {
        const p = proyecto.pasos[paso] ?? { estado: "pendiente" as const };
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
              {!compacto && <span>
                {estado === "ok" && (p.segundos !== undefined ? `Listo en ${p.segundos < 60 ? `${p.segundos} s` : `${Math.round(p.segundos / 60)} min`}` : "Listo")}
                {estado === "corriendo" && (ultima?.estado === "pendiente" ? "En espera…" : `${Math.round(ultima?.pct ?? 0)}%${ultima?.texto ? ` · ${ultima.texto}` : ""}`)}
                {estado === "pendiente" && "Pendiente"}
                {estado === "error" && (ultima?.estado === "interrumpida" ? "Se interrumpió al cerrar la app." : ultima?.error ?? p.detalle ?? "Falló")}
              </span>}
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
    {puedeReanalizar && !reanalizando && (
      <button type="button" className="btn pequeno fantasma" onClick={() => setReanalizando(proyecto.analisis ?? { duracion: "normal" })}>
        <Sparkles size={13} aria-hidden="true" />Analizar de nuevo
      </button>
    )}
    {puedeReanalizar && reanalizando && (
      <div className="reanalizar">
        <OpcionesAnalisis valor={reanalizando} alCambiar={setReanalizando} />
        <p className="ayuda">Se conservan tus favoritos, los clips a mano y los que ya editaste.</p>
        <div className="fila">
          <button type="button" className="btn pequeno primario" onClick={() => { alReanalizar!(limpiarAnalisis(reanalizando)); setReanalizando(null); }}>Analizar</button>
          <button type="button" className="btn pequeno fantasma" onClick={() => setReanalizando(null)}>Cancelar</button>
        </div>
      </div>
    )}
    </>
  );
}
