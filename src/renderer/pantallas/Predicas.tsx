import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Clapperboard, LoaderCircle, MicVocal, Plus } from "lucide-react";
import type { EstadoProyecto, Proyecto } from "@shared/tipos";
import { formatoTamano } from "@shared/tamano";

const ESTADO: Record<EstadoProyecto, string> = {
  nuevo: "En espera",
  transcribiendo: "Transcribiendo…",
  limpiando: "Limpiando el audio…",
  caras: "Buscando al predicador…",
  analizando: "Claude está analizando…",
  listo: "Listo",
  error: "Necesita atención",
};

interface Props {
  alAbrir(id: string): void;
  alNueva(): void;
}

/** Un cuadro del video, 20 s después de que empieza la prédica (o un fondo liso si el video no está). */
function Portada({ p }: { p: Proyecto }) {
  const [sinVideo, setSinVideo] = useState(false);
  // Sin el video original no se pide la portada (fallaría igual).
  const url = p.videoDisponible === false ? undefined : window.reels!.urlVideo?.(p.id);
  if (sinVideo || !url) return <span className="portada portada-vacia" aria-hidden="true"><Clapperboard size={26} /></span>;
  return (
    <span className="portada" aria-hidden="true">
      <video src={`${url}#t=${Math.round(p.rango.inicio + 20)}`} preload="metadata" muted playsInline onError={() => setSinVideo(true)} />
    </span>
  );
}

export function Predicas({ alAbrir, alNueva }: Props) {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [tamanos, setTamanos] = useState<Record<string, number>>({});
  useEffect(() => {
    const api = window.reels!;
    const cargar = () => {
      void api.listarProyectos().then(setProyectos);
      void api.espacioProyectos?.().then(setTamanos).catch(() => undefined);
    };
    cargar();
    return api.alCambiarTareas(cargar);
  }, []);

  return (
    <section className="pantalla" aria-labelledby="t-predicas">
      <div className="pantalla-cabeza">
        <h1 id="t-predicas">Prédicas</h1>
        <button type="button" className="btn primario" onClick={alNueva}><Plus size={16} aria-hidden="true" />Nueva prédica</button>
      </div>
      {proyectos && proyectos.length === 0 && (
        <div className="estado-vacio">
          <MicVocal size={28} aria-hidden="true" />
          <b>Todavía no hay prédicas</b>
          <p>Elige el video de un culto, marca dónde empieza y termina la prédica, y Reels Iglesia te sugiere los mejores momentos para reels.</p>
          <button type="button" className="btn primario" onClick={alNueva}><Plus size={16} aria-hidden="true" />Nueva prédica</button>
        </div>
      )}
      <ul className="proyectos" aria-label="Prédicas">
        {proyectos?.map((p) => (
          <li key={p.id}>
            <button type="button" className="proyecto" onClick={() => alAbrir(p.id)}>
              <Portada p={p} />
              <b>{p.nombre}</b>
              <span className="mono">{new Date(p.creado).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}</span>
              <span className="duracion-predica">Prédica de {Math.max(1, Math.round((p.rango.fin - p.rango.inicio) / 60))} min</span>
              {tamanos[p.id] !== undefined && <span className="tamano-predica mono">{formatoTamano(tamanos[p.id])}</span>}
              {p.videoDisponible === false && <span className="sin-video"><CircleAlert size={13} aria-hidden="true" />Video no encontrado</span>}
              <span className={`estado ${p.estado}`}>
                {p.estado === "listo" ? <CircleCheck size={14} aria-hidden="true" /> : p.estado === "error" ? <CircleAlert size={14} aria-hidden="true" /> : <LoaderCircle size={14} className="girar" aria-hidden="true" />}
                {ESTADO[p.estado]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
