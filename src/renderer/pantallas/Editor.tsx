import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Contrast, Sparkles, TrendingUp, TriangleAlert } from "lucide-react";
import type { ClipSpec, Proyecto, Tarea } from "@shared/tipos";
import { formatoTiempo } from "@shared/validar";
import { ListaClips } from "../componentes/ListaClips";
import { PanelProceso } from "../componentes/PanelProceso";

export function Editor({ proyectoId }: { proyectoId: string }) {
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [clips, setClips] = useState<ClipSpec[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [sel, setSel] = useState<string | undefined>();
  const video = useRef<HTMLVideoElement>(null);

  const recargar = useCallback(async () => {
    const api = window.reels!;
    const [p, c] = await Promise.all([api.leerProyecto(proyectoId), api.leerClips(proyectoId)]);
    setProyecto(p);
    setClips(c);
    setSel((s) => s ?? [...c].sort((a, b) => b.puntaje - a.puntaje)[0]?.id);
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

  const clip = clips.find((c) => c.id === sel);

  useEffect(() => {
    if (clip && video.current) { video.current.currentTime = clip.inicio; }
  }, [clip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!proyecto) return <div className="cargando">Cargando…</div>;
  const url = window.reels!.urlVideo(proyecto.id);

  return (
    <div className="editor">
      <aside className="editor-izq" aria-label="Proceso y clips">
        <div className="titulo-seccion">Proceso</div>
        <PanelProceso proyecto={proyecto} tareas={tareas} alReintentar={(id) => void window.reels!.reintentar(id)} />
        <div className="titulo-seccion">Clips <span>{clips.length === 1 ? "1 sugerido" : clips.length ? `${clips.length} sugeridos` : ""}</span></div>
        {clips.length > 0 ? (
          <ListaClips clips={clips} seleccionado={sel} alElegir={setSel} urlVideo={proyecto.videoDisponible ? url : undefined} />
        ) : (
          <p className="vacio">Los clips aparecerán aquí cuando Claude termine de analizar la prédica.</p>
        )}
      </aside>

      <main className="editor-centro" aria-label="Vista previa">
        {!proyecto.videoDisponible && (
          <p className="aviso" role="alert"><TriangleAlert size={16} aria-hidden="true" />No encuentro el video original en «{proyecto.video.ruta}». Si lo moviste, vuelve a ponerlo ahí. La transcripción y los clips se conservan.</p>
        )}
        {clip && <div className="centro-cabeza"><h2>{clip.titulo}</h2><span>{clip.categoria} · {formatoTiempo(clip.fin - clip.inicio)}</span></div>}
        {proyecto.videoDisponible && (
          <video ref={video} className="reproductor" src={url} controls preload="metadata"
            onTimeUpdate={(e) => { if (clip && e.currentTarget.currentTime >= clip.fin) e.currentTarget.pause(); }} />
        )}
      </main>

      <aside className="editor-der" aria-label="Datos del clip">
        {clip ? (
          <>
            <div className="dato"><span className="etiqueta">Gancho en pantalla</span><b>{clip.gancho}</b>
              {clip.ganchosAlternativos.length > 0 && (
                <div className="alternativas">{clip.ganchosAlternativos.map((g) => <span key={g} className="alt"><Sparkles size={12} aria-hidden="true" />{g}</span>)}</div>
              )}
            </div>
            <div className="porque"><TrendingUp size={16} aria-hidden="true" /><div><b>{clip.puntaje} · Por qué funciona.</b> {clip.razon}</div></div>
            {clip.versiculos.map((v) => (
              <div key={v.ref} className="tarjeta"><div className="tarjeta-cabeza"><BookOpen size={16} aria-hidden="true" /><b>{v.ref}</b><span className="mono">{formatoTiempo(v.en)}</span></div>
                <p>Los subtítulos se ocultarán mientras aparezca la cita.</p></div>
            ))}
            {clip.apertura && (
              <div className="tarjeta"><div className="tarjeta-cabeza"><Contrast size={16} aria-hidden="true" /><b>Apertura en blanco y negro</b></div>
                <p>«{clip.apertura.frase}» · {(clip.apertura.fin - clip.apertura.inicio).toFixed(1)} s</p></div>
            )}
            <div className="dato"><span className="etiqueta">Texto para publicar</span><p>{clip.descripcion}</p><p className="mono hashtags">{clip.hashtags.join(" ")}</p></div>
          </>
        ) : (
          <p className="vacio">Elige un clip para ver sus datos.</p>
        )}
      </aside>
    </div>
  );
}
