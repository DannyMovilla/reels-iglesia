import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, MicVocal, Plus } from "lucide-react";
import type { EstadoProyecto, Proyecto } from "@shared/tipos";

const ESTADO: Record<EstadoProyecto, string> = {
  nuevo: "En espera",
  transcribiendo: "Transcribiendo…",
  caras: "Buscando al predicador…",
  analizando: "Claude está analizando…",
  listo: "Listo",
  error: "Necesita atención",
};

interface Props {
  alAbrir(id: string): void;
  alNueva(): void;
}

export function Predicas({ alAbrir, alNueva }: Props) {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  useEffect(() => {
    const api = window.reels!;
    void api.listarProyectos().then(setProyectos);
    return api.alCambiarTareas(() => void api.listarProyectos().then(setProyectos));
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
              <b>{p.nombre}</b>
              <span className="mono">{new Date(p.creado).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}</span>
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
