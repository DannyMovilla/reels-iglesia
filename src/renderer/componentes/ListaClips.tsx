import { useState } from "react";
import { BookOpen } from "lucide-react";
import type { ClipSpec } from "@shared/tipos";
import { formatoTiempo } from "@shared/validar";
import { AnilloPuntaje } from "./AnilloPuntaje";

interface Props {
  clips: ClipSpec[];
  seleccionado?: string;
  alElegir(id: string): void;
  /** URL del video original para las miniaturas (cuadro en el inicio de cada clip). */
  urlVideo?: string;
}

export function ListaClips({ clips, seleccionado, alElegir, urlVideo }: Props) {
  const [filtro, setFiltro] = useState<"todos" | "versiculo">("todos");
  const visibles = [...clips].sort((a, b) => b.puntaje - a.puntaje).filter((c) => filtro === "todos" || c.versiculos.length > 0);
  return (
    <div className="lista-clips">
      <div className="filtros" role="group" aria-label="Filtrar clips">
        <button type="button" className="chipf" aria-pressed={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos</button>
        <button type="button" className="chipf" aria-pressed={filtro === "versiculo"} onClick={() => setFiltro("versiculo")}>Con versículo</button>
      </div>
      <ul className="clips" aria-label="Clips sugeridos">
        {visibles.map((c) => (
          <li key={c.id}>
            <button type="button" className="clip" aria-current={c.id === seleccionado} onClick={() => alElegir(c.id)}>
              <span className="miniatura">
                {urlVideo && <video src={`${urlVideo}#t=${c.inicio + 1}`} preload="metadata" muted aria-hidden="true" tabIndex={-1} />}
                <span className="duracion mono">{formatoTiempo(c.fin - c.inicio)}</span>
              </span>
              <span className="clip-texto">
                <h3>{c.titulo}</h3>
                <span className="meta">
                  <span className="tag">{c.categoria}</span>
                  {c.versiculos.map((v) => (
                    <span key={v.ref} className="tag versiculo"><BookOpen size={11} aria-hidden="true" />{v.ref}</span>
                  ))}
                </span>
              </span>
              <AnilloPuntaje valor={c.puntaje} />
            </button>
          </li>
        ))}
        {visibles.length === 0 && <li className="vacio">No hay clips con este filtro.</li>}
      </ul>
    </div>
  );
}
