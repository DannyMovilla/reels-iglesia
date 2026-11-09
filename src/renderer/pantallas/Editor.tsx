import { useCallback, useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { Caras, ClipSpec, Marca, Proyecto, Tarea, Transcripcion } from "@shared/tipos";
import { formatoTiempo } from "@shared/validar";
import { duracionReel, palabrasDe, partesDelReel, reelAVideo, videoAReel } from "@shared/reel/tiempo";
import type { Correccion } from "@shared/correcciones";
import { estiloDesdeClip, moverVersiculos } from "@shared/clip";
import type { Pista } from "@shared/reel/pistas";
import { Download, FileText, Play, Plus, Scissors } from "lucide-react";
import { ColaExportacion } from "../componentes/ColaExportacion";
import { Inspector } from "../componentes/Inspector";
import type { EntradaChat } from "../componentes/ChatClip";
import { LineaTiempo } from "../componentes/LineaTiempo";
import { ListaClips } from "../componentes/ListaClips";
import { PanelProceso } from "../componentes/PanelProceso";
import { Transcripcion as VistaTranscripcion } from "../componentes/Transcripcion";
import { VistaPrevia, type ControlVistaPrevia } from "../componentes/VistaPrevia";

interface Datos {
  transcripcion: Transcripcion | null;
  caras: Caras | null;
  marca: Marca | null;
  dimensiones: { ancho: number; alto: number } | null;
}

/** Lo que se dice dentro del clip (para el buscador de la lista). */
const textoDelClip = (t: Transcripcion, c: ClipSpec): string =>
  t.segmentos.filter((s) => s.e > c.inicio && s.s < c.fin).map((s) => s.t).join(" ");

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
  const [pistas, setPistas] = useState<Pista[]>([]);
  const [centro, setCentro] = useState<"vista" | "transcripcion">("vista");
  const [rango, setRango] = useState<{ inicio: number; fin: number } | null>(null);
  /** Pedidos a Claude por clip (en esta sesión), para el historial y Deshacer. */
  const [conversaciones, setConversaciones] = useState<Record<string, EntradaChat[]>>({});
  useEffect(() => { void window.reels!.listarPistas?.().then(setPistas); }, []);

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

  /** `editar: false` para favorito u ocultar (no cuentan como edición del clip). */
  const cambiarClip = (c: ClipSpec, editar = true) => {
    const editado: ClipSpec = { ...c, estado: editar && c.estado === "sugerido" ? "editado" : c.estado };
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

  const [errorUbicar, setErrorUbicar] = useState<string | null>(null);
  const ubicar = async () => {
    setErrorUbicar(null);
    try {
      if (await window.reels!.ubicarVideo(proyectoId)) await recargar();
    } catch (e) {
      setErrorUbicar((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  };

  const guardarEstilo = async (c: ClipSpec) => {
    const m = await window.reels!.leerMarca();
    const nueva = { ...m, estilo: estiloDesdeClip(c) };
    await window.reels!.guardarMarca(nueva);
    setDatos((d) => ({ ...d, marca: nueva }));
  };

  const aplicarEstilo = async () => {
    await guardarYa();
    await window.reels!.aplicarEstilo(proyectoId);
    setClips(await window.reels!.leerClips(proyectoId));
  };

  const exportar = async (id: string, clipIds: string[]) => {
    await guardarYa();
    await window.reels!.exportar(id, clipIds);
  };

  /** Nuevo corte: el versículo se desplaza para seguir en el mismo momento del video. */
  const cambiarCorte = (c: ClipSpec, inicio: number, fin: number) => {
    cambiarClip({ ...c, inicio, fin, versiculos: moverVersiculos(c.versiculos, c.inicio, c.fin, inicio, fin) });
  };

  const crearClip = async (r: { inicio: number; fin: number }) => {
    await guardarYa();
    const nuevo = await window.reels!.crearClip(proyectoId, r.inicio, r.fin);
    setClips((cs) => [...cs, nuevo]);
    setSel(nuevo.id);
  };

  const corregirPalabra = async (c: Correccion) => {
    const transcripcion = await window.reels!.corregir(proyectoId, c);
    setDatos((d) => ({ ...d, transcripcion }));
  };

  if (!proyecto) return <div className="cargando">Cargando…</div>;
  const clip = clips.find((c) => c.id === sel);
  const listo = clip && datos.transcripcion && datos.marca && datos.dimensiones;
  // La transcripción trabaja en segundos del video original; la vista previa, en segundos del reel.
  const parteClip = clip && datos.transcripcion ? partesDelReel(clip, palabrasDe(datos.transcripcion)).find((p) => p.tipo === "clip") : undefined;
  const tiempoVideo = parteClip && tiempo >= parteClip.inicioReel && tiempo <= parteClip.inicioReel + parteClip.duracion ? reelAVideo(parteClip, tiempo) : undefined;
  const irAVideo = (t: number) => {
    const r = parteClip ? videoAReel(parteClip, t) : null;
    if (r === null) return;
    setTiempo(r);
    vista.current?.seek(r);
  };
  const rangoEnClip = clip && rango && rango.inicio >= clip.inicio && rango.fin <= clip.fin ? rango : null;

  return (
    <div className="editor">
      <aside className="editor-izq" aria-label="Proceso y clips">
        <div className="titulo-seccion">Proceso</div>
        <PanelProceso proyecto={proyecto} tareas={tareas} alReintentar={(id) => void window.reels!.reintentar(id)}
          alProcesar={(desde) => void window.reels!.procesar(proyecto.id, desde)}
          alReanalizar={(a) => void window.reels!.reanalizar(proyecto.id, a).then(recargar)} />
        <div className="titulo-seccion">Clips <span>{clips.length === 1 ? "1 sugerido" : clips.length ? `${clips.length} sugeridos` : ""}</span></div>
        {clips.length > 1 && (
          <button type="button" className="btn pequeno exportar-todos" onClick={() => void exportar(proyecto.id, clips.map((c) => c.id))}>
            <Download size={13} aria-hidden="true" />Exportar {clips.length} clips
          </button>
        )}
        {clips.length > 0 ? (
          <ListaClips clips={clips} seleccionado={sel} alElegir={setSel} alCambiar={(c) => cambiarClip(c, false)}
            textoDe={datos.transcripcion ? (c) => textoDelClip(datos.transcripcion!, c) : undefined} urlVideo={proyecto.videoDisponible ? window.reels!.urlVideo(proyecto.id) : undefined} />
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
          <p className="aviso" role="alert"><TriangleAlert size={16} aria-hidden="true" />No encuentro el video original en «{proyecto.video.ruta}». La transcripción y los clips se conservan.
            <button type="button" className="btn pequeno" onClick={() => void ubicar()}>Ubicar el video</button></p>
        )}
        {errorUbicar && <p className="error" role="alert">{errorUbicar}</p>}
        {clip && <div className="centro-cabeza"><h2>{clip.titulo}</h2><span>{clip.categoria} · {formatoTiempo(datos.transcripcion ? duracionReel(clip, palabrasDe(datos.transcripcion)) : clip.fin - clip.inicio)}</span></div>}
        {datos.transcripcion && (
          <div className="pestanas centro-pestanas" role="tablist" aria-label="Vista del centro">
            <button type="button" role="tab" aria-selected={centro === "vista"} onClick={() => setCentro("vista")}><Play size={14} aria-hidden="true" />Vista previa</button>
            <button type="button" role="tab" aria-selected={centro === "transcripcion"} onClick={() => setCentro("transcripcion")}><FileText size={14} aria-hidden="true" />Transcripción</button>
          </div>
        )}
        {centro === "transcripcion" && datos.transcripcion && (
          <>
            <VistaTranscripcion transcripcion={datos.transcripcion} clip={clip} tiempoVideo={tiempoVideo ?? undefined}
              alBuscar={irAVideo} alCorregir={(c) => void corregirPalabra(c)} alSeleccionar={setRango} />
            {rango && (
              <div className="barra-rango" role="toolbar" aria-label="Tramo elegido">
                <span className="mono">{formatoTiempo(rango.inicio)} – {formatoTiempo(rango.fin)}</span>
                <button type="button" className="btn pequeno primario" onClick={() => void crearClip(rango)}>
                  <Plus size={13} aria-hidden="true" />Crear clip con esto
                </button>
                {rangoEnClip && clip && (
                  <button type="button" className="btn pequeno" onClick={() => cambiarClip({ ...clip, cortes: { ...clip.cortes, quitados: [...(clip.cortes.quitados ?? []), rangoEnClip] } })}>
                    <Scissors size={13} aria-hidden="true" />Quitar del clip
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {listo && (
          <div className="centro-vista" hidden={centro !== "vista"}>
          <VistaPrevia ref={vista} proyectoId={proyecto.id} clip={clip} transcripcion={datos.transcripcion!} caras={datos.caras}
            marca={datos.marca!} dimensiones={datos.dimensiones!} predicador={proyecto.predicador ?? datos.marca?.predicador}
            inicioRango={proyecto.pasos.audio?.estado === "ok" ? proyecto.rango.inicio : undefined} alAvisos={setAvisos} alTiempo={setTiempo} />
          </div>
        )}
      </main>

      <aside className="editor-der" aria-label="Datos del clip">
        {clip ? <Inspector clip={clip} avisos={avisos} alCambiar={cambiarClip} alGuardarEstilo={(c) => void guardarEstilo(c)} alAplicarEstilo={() => void aplicarEstilo()} pistas={pistas} palabras={datos.transcripcion ? palabrasDe(datos.transcripcion) : undefined}
          chat={datos.transcripcion ? { proyectoId, historial: conversaciones[clip.id] ?? [], alHistorial: (h) => setConversaciones((x) => ({ ...x, [clip.id]: h })) } : undefined} /> : <p className="vacio">Elige un clip para editarlo.</p>}
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
