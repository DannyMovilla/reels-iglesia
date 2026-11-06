import { useCallback, useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { Caras, ClipSpec, Marca, Proyecto, Tarea, Transcripcion } from "@shared/tipos";
import { formatoTiempo } from "@shared/validar";
import { palabrasDe } from "@shared/reel/tiempo";
import { Download } from "lucide-react";
import { ColaExportacion } from "../componentes/ColaExportacion";
import { Inspector } from "../componentes/Inspector";
import { LineaTiempo } from "../componentes/LineaTiempo";
import { ListaClips } from "../componentes/ListaClips";
import { PanelProceso } from "../componentes/PanelProceso";
import { VistaPrevia, type ControlVistaPrevia } from "../componentes/VistaPrevia";

interface Datos {
  transcripcion: Transcripcion | null;
  caras: Caras | null;
  marca: Marca | null;
  dimensiones: { ancho: number; alto: number } | null;
}

export function Editor({ proyectoId }: { proyectoId: string }) {
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [clips, setClips] = useState<ClipSpec[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [sel, setSel] = useState<string | undefined>();
  const [datos, setDatos] = useState<Datos>({ transcripcion: null, caras: null, marca: null, dimensiones: null });
  const [avisos, setAvisos] = useState<string[]>([]);
  const [tiempo, setTiempo] = useState(0);
  const [abierto] = useState(() => new Date().toISOString());
  const vista = useRef<ControlVistaPrevia>(null);
  const guardando = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendiente = useRef<ClipSpec | null>(null);

  const recargar = useCallback(async () => {
    const api = window.reels!;
    const [p, c] = await Promise.all([api.leerProyecto(proyectoId), api.leerClips(proyectoId)]);
    setProyecto(p);
    if (!guardando.current) setClips(c); // no pisar una edición que todavía no se guardó
    setSel((s) => (s && c.some((x) => x.id === s) ? s : [...c].sort((a, b) => b.puntaje - a.puntaje)[0]?.id));
    if (p.pasos.transcripcion.estado === "ok" && p.videoDisponible) {
      const [transcripcion, caras, marca, dimensiones] = await Promise.all([
        api.leerTranscripcion(proyectoId), api.leerCaras(proyectoId), api.leerMarca(), api.infoVideo(proyectoId).catch(() => null),
      ]);
      setDatos((d) => (d.transcripcion && d.dimensiones ? d : { transcripcion, caras, marca, dimensiones }));
    }
  }, [proyectoId]);

  useEffect(() => {
    const api = window.reels!;
    void recargar();
    void api.tareas().then(setTareas);
    let firma = "";
    return api.alCambiarTareas((t) => {
      setTareas(t);
      const nueva = t.filter((x) => x.proyectoId === proyectoId).map((x) => x.estado).join(",");
      if (nueva !== firma) { firma = nueva; void recargar(); }
    });
  }, [proyectoId, recargar]);

  const cambiarClip = (c: ClipSpec) => {
    const editado: ClipSpec = { ...c, estado: c.estado === "sugerido" ? "editado" : c.estado };
    setClips((cs) => cs.map((x) => (x.id === editado.id ? editado : x)));
    if (guardando.current) clearTimeout(guardando.current);
    pendiente.current = editado;
    guardando.current = setTimeout(() => void guardarYa(), 400);
  };

  /** Guarda ya la última edición (la exportación toma el clip del disco: debe llevar lo que la persona ve). */
  const guardarYa = async () => {
    if (guardando.current) clearTimeout(guardando.current);
    const c = pendiente.current;
    pendiente.current = null;
    if (c) await window.reels!.guardarClip(proyectoId, c);
    if (!pendiente.current) guardando.current = null;
  };

  const exportar = async (id: string, clipIds: string[]) => {
    await guardarYa();
    await window.reels!.exportar(id, clipIds);
  };

  /** Nuevo corte: el versículo se desplaza para seguir en el mismo momento del video. */
  const cambiarCorte = (c: ClipSpec, inicio: number, fin: number) => {
    const d = inicio - c.inicio;
    cambiarClip({ ...c, inicio, fin, versiculos: c.versiculos.map((v) => ({ ...v, en: Math.max(0, Math.round((v.en - d) * 100) / 100) })) });
  };

  if (!proyecto) return <div className="cargando">Cargando…</div>;
  const clip = clips.find((c) => c.id === sel);
  const listo = clip && datos.transcripcion && datos.marca && datos.dimensiones;

  return (
    <div className="editor">
      <aside className="editor-izq" aria-label="Proceso y clips">
        <div className="titulo-seccion">Proceso</div>
        <PanelProceso proyecto={proyecto} tareas={tareas} alReintentar={(id) => void window.reels!.reintentar(id)}
          alProcesar={(desde) => void window.reels!.procesar(proyecto.id, desde)} />
        <div className="titulo-seccion">Clips <span>{clips.length === 1 ? "1 sugerido" : clips.length ? `${clips.length} sugeridos` : ""}</span></div>
        {clips.length > 1 && (
          <button type="button" className="btn pequeno exportar-todos" onClick={() => void exportar(proyecto.id, clips.map((c) => c.id))}>
            <Download size={13} aria-hidden="true" />Exportar {clips.length} clips
          </button>
        )}
        {clips.length > 0 ? (
          <ListaClips clips={clips} seleccionado={sel} alElegir={setSel} urlVideo={proyecto.videoDisponible ? window.reels!.urlVideo(proyecto.id) : undefined} />
        ) : (
          <p className="vacio">Los clips aparecerán aquí cuando Claude termine de analizar la prédica.</p>
        )}
        <span className="espacio" />
        <ColaExportacion proyectoId={proyecto.id}
          tareas={tareas.filter((t) => t.creada >= abierto || t.estado === "pendiente" || t.estado === "corriendo")}
          alCancelar={(id) => void window.reels!.cancelar(id)} alAbrirCarpeta={() => void window.reels!.abrirCarpetaExportados(proyecto.id)} />
      </aside>

      <main className="editor-centro" aria-label="Vista previa">
        {!proyecto.videoDisponible && (
          <p className="aviso" role="alert"><TriangleAlert size={16} aria-hidden="true" />No encuentro el video original en «{proyecto.video.ruta}». Si lo moviste, vuelve a ponerlo ahí. La transcripción y los clips se conservan.</p>
        )}
        {clip && <div className="centro-cabeza"><h2>{clip.titulo}</h2><span>{clip.categoria} · {formatoTiempo(clip.fin - clip.inicio)}</span></div>}
        {listo && (
          <VistaPrevia ref={vista} proyectoId={proyecto.id} clip={clip} transcripcion={datos.transcripcion!} caras={datos.caras}
            marca={datos.marca!} dimensiones={datos.dimensiones!} alAvisos={setAvisos} alTiempo={setTiempo} />
        )}
      </main>

      <aside className="editor-der" aria-label="Datos del clip">
        {clip ? <Inspector clip={clip} avisos={avisos} alCambiar={cambiarClip} /> : <p className="vacio">Elige un clip para editarlo.</p>}
        {clip && (
          <div className="inspector-pie">
            <button type="button" className="btn primario" disabled={clip.formatos.length === 0}
              onClick={() => void exportar(proyecto.id, [clip.id])}>
              <Download size={15} aria-hidden="true" />Exportar este clip
            </button>
          </div>
        )}
      </aside>

      <div className="editor-abajo">
        {listo && (
          <LineaTiempo clip={clip} palabras={palabrasDe(datos.transcripcion!)} tiempoActual={tiempo}
            alBuscar={(t) => { setTiempo(t); vista.current?.seek(t); }}
            alCambiarCorte={(i, f) => cambiarCorte(clip, i, f)} alAlternarReproduccion={() => vista.current?.alternar()} />
        )}
      </div>
    </div>
  );
}
