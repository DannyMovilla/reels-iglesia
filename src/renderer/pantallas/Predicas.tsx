import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Clapperboard, EllipsisVertical, LoaderCircle, MicVocal, Plus, Trash2 } from "lucide-react";
import type { EstadoProyecto, Proyecto } from "@shared/tipos";
import { formatoTamano } from "@shared/tamano";
// El mismo que el resto de las pantallas: quita el prefijo en inglés que agrega Electron.
import { limpiarError } from "../componentes/Entregas";

const ESTADO: Record<EstadoProyecto, string> = {
  nuevo: "En espera",
  transcribiendo: "Transcribiendo…",
  limpiando: "Limpiando el audio…",
  caras: "Buscando al predicador…",
  analizando: "Claude está analizando…",
  listo: "Listo",
  error: "Necesita atención",
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Aviso antes de mandar una prédica a la Papelera: dice qué se va y que el video original se queda. */
function ConfirmarBorrado({ p, alListo, alCancelar }: { p: Proyecto; alListo(): void; alCancelar(): void }) {
  const [resumen, setResumen] = useState<{ clips: number; reels: number; bytes: number } | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void window.reels!.resumenBorrado(p.id).then(setResumen).catch((e) => setError(limpiarError(e))); }, [p.id]);
  const borrar = async () => {
    setBorrando(true);
    setError(null);
    try {
      await window.reels!.borrarProyecto(p.id);
      alListo();
    } catch (e) {
      setError(limpiarError(e));
      setBorrando(false);
    }
  };
  return (
    <div className="confirmar-borrado" role="alertdialog" aria-label={`Borrar ${p.nombre}`}>
      <b>¿Borrar «{p.nombre}»?</b>
      {resumen && <p>Se van a la Papelera la transcripción, {plural(resumen.clips, "clip", "clips")}, {plural(resumen.reels, "reel exportado", "reels exportados")} y las frases ({formatoTamano(resumen.bytes)}). El video original del culto no se borra.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="fila">
        <button type="button" className="btn peligro" disabled={!resumen || borrando} onClick={() => void borrar()}>
          {borrando ? <LoaderCircle size={14} className="girar" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}Borrar
        </button>
        <button type="button" className="btn fantasma" onClick={alCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

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
  const [menu, setMenu] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<Proyecto | null>(null);
  const pedido = useRef(0);
  const cargar = () => {
    const api = window.reels!;
    // Solo la última respuesta cuenta (una medición vieja no pisa una nueva).
    const n = ++pedido.current;
    void api.listarProyectos().then((l) => { if (n === pedido.current) setProyectos(l); });
    void api.espacioProyectos?.().then((t) => { if (n === pedido.current) setTamanos(t); }).catch(() => undefined);
  };
  useEffect(() => {
    cargar();
    // Las tareas avisan en cada avance de progreso; recargar (y medir carpetas) solo cuando alguna cambia de estado.
    let firma = "";
    return window.reels!.alCambiarTareas((tareas) => {
      const nueva = tareas.map((t) => `${t.id}:${t.estado}`).join("|");
      if (nueva === firma) return;
      firma = nueva;
      cargar();
    });
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
          <li key={p.id} className="proyecto-item">
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
            <button type="button" className="btn-icono mas-opciones" aria-label={`Más opciones de ${p.nombre}`} aria-haspopup="menu" aria-expanded={menu === p.id}
              onClick={() => setMenu(menu === p.id ? null : p.id)}><EllipsisVertical size={16} aria-hidden="true" /></button>
            {menu === p.id && (
              <div className="menu-proyecto" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(null); setBorrar(p); }}><Trash2 size={14} aria-hidden="true" />Borrar prédica</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {borrar && <ConfirmarBorrado p={borrar} alCancelar={() => setBorrar(null)} alListo={() => { setBorrar(null); cargar(); }} />}
    </section>
  );
}
