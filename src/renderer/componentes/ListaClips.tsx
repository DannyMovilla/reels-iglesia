import { useState } from "react";
import { BookOpen, Eye, EyeOff, Hand, Search, SlidersHorizontal, Star } from "lucide-react";
import { CATEGORIAS, type ClipSpec } from "@shared/tipos";
import { filtrarClips, FILTRO_INICIAL, type FiltroClips } from "@shared/filtro-clips";
import { formatoTiempo } from "@shared/validar";
import { AnilloPuntaje } from "./AnilloPuntaje";

interface Props {
  clips: ClipSpec[];
  seleccionado?: string;
  alElegir(id: string): void;
  /** Marcar favorito u ocultar un clip (se guarda como una edición). */
  alCambiar?(c: ClipSpec): void;
  /** Lo que se dice en el clip (para el buscador). */
  textoDe?(c: ClipSpec): string;
  /** URL del video original para las miniaturas (cuadro en el inicio de cada clip). */
  urlVideo?: string;
}

const ORDENES: [FiltroClips["orden"], string][] = [["impacto", "Mayor impacto"], ["video", "Orden en el video"], ["cortos", "Más cortos"], ["largos", "Más largos"]];
const DURACIONES: [FiltroClips["duracion"], string][] = [["todas", "Todas"], ["corta", "Menos de 30 s"], ["media", "30 a 60 s"], ["larga", "Más de 60 s"]];

export function ListaClips({ clips, seleccionado, alElegir, alCambiar, textoDe, urlVideo }: Props) {
  const [f, setF] = useState<FiltroClips>(FILTRO_INICIAL);
  const [abiertos, setAbiertos] = useState(false);
  const cambiarF = (parcial: Partial<FiltroClips>) => setF((x) => ({ ...x, ...parcial }));
  const visibles = filtrarClips(clips, f, textoDe);
  const activos = f.categorias.length + (f.duracion !== "todas" ? 1 : 0) + (f.puntajeMinimo > 0 ? 1 : 0) + (f.ocultos ? 1 : 0);
  const rapido = f.favoritos ? "favoritos" : f.conVersiculo ? "versiculo" : "todos";

  return (
    <div className="lista-clips">
      <label className="buscador">
        <Search size={14} aria-hidden="true" />
        <input aria-label="Buscar clips" placeholder="Buscar por título, gancho o lo que se dice" value={f.texto} onChange={(e) => cambiarF({ texto: e.target.value })} />
      </label>
      <div className="filtros" role="group" aria-label="Filtrar clips">
        <button type="button" className="chipf" aria-pressed={rapido === "todos"} onClick={() => cambiarF({ favoritos: false, conVersiculo: false })}>Todos</button>
        <button type="button" className="chipf" aria-pressed={rapido === "favoritos"} onClick={() => cambiarF({ favoritos: true, conVersiculo: false })}>Favoritos</button>
        <button type="button" className="chipf" aria-pressed={rapido === "versiculo"} onClick={() => cambiarF({ favoritos: false, conVersiculo: true })}>Con versículo</button>
        <button type="button" className="chipf" aria-expanded={abiertos} onClick={() => setAbiertos((a) => !a)}>
          <SlidersHorizontal size={12} aria-hidden="true" />Filtros{activos ? ` (${activos})` : ""}
        </button>
      </div>
      {abiertos && (
        <div className="panel-filtros">
          <fieldset>
            <legend>Categoría</legend>
            {CATEGORIAS.map((c) => (
              <label key={c} className="fila">
                <input type="checkbox" checked={f.categorias.includes(c)}
                  onChange={(e) => cambiarF({ categorias: e.target.checked ? [...f.categorias, c] : f.categorias.filter((x) => x !== c) })} />{c}
              </label>
            ))}
          </fieldset>
          <label className="campo">Duración
            <select className="entrada" value={f.duracion} onChange={(e) => cambiarF({ duracion: e.target.value as FiltroClips["duracion"] })}>
              {DURACIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          <label className="campo">
            <span className="campo-cabeza">Puntaje mínimo <span className="mono">{f.puntajeMinimo}</span></span>
            <input type="range" aria-label="Puntaje mínimo" min={0} max={100} step={5} value={f.puntajeMinimo} onChange={(e) => cambiarF({ puntajeMinimo: Number(e.target.value) })} />
          </label>
          <label className="fila"><input type="checkbox" checked={f.ocultos} onChange={(e) => cambiarF({ ocultos: e.target.checked })} />Ver ocultos</label>
          {activos > 0 && <button type="button" className="btn pequeno fantasma" onClick={() => setF({ ...FILTRO_INICIAL, texto: f.texto, orden: f.orden })}>Quitar filtros</button>}
        </div>
      )}
      <div className="fila lista-cabeza">
        <span className="ayuda">Mostrando {visibles.length} de {clips.length}</span>
        <label className="orden">
          <select aria-label="Ordenar" value={f.orden} onChange={(e) => cambiarF({ orden: e.target.value as FiltroClips["orden"] })}>
            {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </div>
      <ul className="clips" aria-label="Clips sugeridos">
        {visibles.map((c) => (
          <li key={c.id} className={c.oculto ? "oculto" : ""}>
            <button type="button" className="clip" aria-current={c.id === seleccionado} onClick={() => alElegir(c.id)}>
              <span className="miniatura">
                {urlVideo && <video src={`${urlVideo}#t=${c.inicio + 1}`} preload="metadata" muted aria-hidden="true" tabIndex={-1} />}
                <span className="duracion mono">{formatoTiempo(c.fin - c.inicio)}</span>
              </span>
              <span className="clip-texto">
                <h3>{c.titulo}</h3>
                <span className="meta">
                  {c.origen === "manual" ? <span className="tag"><Hand size={11} aria-hidden="true" />A mano</span> : <span className="tag">{c.categoria}</span>}
                  {c.versiculos.map((v) => (
                    <span key={v.ref} className="tag versiculo"><BookOpen size={11} aria-hidden="true" />{v.ref}</span>
                  ))}
                </span>
              </span>
              {c.origen !== "manual" && <AnilloPuntaje valor={c.puntaje} />}
            </button>
            {alCambiar && (
              <span className="clip-acciones">
                <button type="button" className={`btn icono pequeno ${c.favorito ? "activo" : ""}`} aria-pressed={!!c.favorito}
                  aria-label={c.favorito ? `Quitar «${c.titulo}» de favoritos` : `Marcar «${c.titulo}» como favorito`}
                  onClick={() => alCambiar({ ...c, favorito: !c.favorito })}><Star size={13} aria-hidden="true" fill={c.favorito ? "currentColor" : "none"} /></button>
                <button type="button" className="btn icono pequeno" aria-label={c.oculto ? `Mostrar «${c.titulo}»` : `Ocultar «${c.titulo}»`}
                  onClick={() => alCambiar({ ...c, oculto: !c.oculto })}>{c.oculto ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}</button>
              </span>
            )}
          </li>
        ))}
        {visibles.length === 0 && <li className="vacio">No hay clips con este filtro.</li>}
      </ul>
    </div>
  );
}
