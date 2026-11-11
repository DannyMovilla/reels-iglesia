import { useEffect, useState } from "react";
import { Clapperboard, FolderOpen, LoaderCircle, Trash2 } from "lucide-react";
import { formatoTamano } from "@shared/tamano";
// El mismo que el resto de las pantallas: quita el prefijo en inglés que agrega Electron.
import { limpiarError } from "../componentes/Entregas";

type Lista = Awaited<ReturnType<NonNullable<typeof window.reels>["listarExportados"]>>;

/** Formato de un reel según su nombre (`…-9x16.mp4` → «9:16»); null si el nombre no lo dice. */
export function formatoDeArchivo(nombre: string): "9:16" | "4:5" | "1:1" | null {
  const m = /(9x16|4x5|1x1)/.exec(nombre);
  return m ? (m[1].replace("x", ":") as "9:16" | "4:5" | "1:1") : null;
}

const cuantos = (n: number) => (n === 1 ? "1 reel" : `${n} reels`);

interface Pedido { proyectoId: string; mp4s: string[] | "todos"; texto: string }

/** Todos los reels exportados, agrupados por prédica. */
export function Exportados() {
  const [lista, setLista] = useState<Lista | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cargar = () => void window.reels!.listarExportados().then(setLista);
  useEffect(() => {
    cargar();
    return window.reels!.alCambiarTareas(cargar);
  }, []);
  const borrar = async () => {
    if (!pedido) return;
    setBorrando(true);
    setError(null);
    try {
      await window.reels!.borrarReels(pedido.proyectoId, pedido.mp4s);
      setPedido(null);
      cargar();
    } catch (e) {
      setError(limpiarError(e));
    } finally {
      setBorrando(false);
    }
  };

  return (
    <section className="pantalla" aria-labelledby="t-exportados">
      <div className="pantalla-cabeza"><h1 id="t-exportados">Exportados</h1></div>
      {lista && lista.length === 0 && (
        <div className="estado-vacio">
          <Clapperboard size={28} aria-hidden="true" />
          <b>Todavía no hay reels exportados</b>
          <p>Abre una prédica, elige un clip y toca «Exportar este clip». Los MP4 aparecen aquí y en la carpeta de cada prédica.</p>
        </div>
      )}
      {lista?.map((p) => (
        <div key={p.proyectoId} className="grupo-exportados">
          <div className="fila"><b>{p.nombre}</b><span className="tenue">{cuantos(p.archivos.filter((a) => /\.mp4$/i.test(a.nombre)).length)}</span><span className="espacio" />
            <button type="button" className="btn pequeno" onClick={() => void window.reels!.abrirCarpetaExportados(p.proyectoId)}><FolderOpen size={13} aria-hidden="true" />Abrir carpeta</button>
            <button type="button" className="btn pequeno fantasma" aria-label={`Borrar todos los reels de ${p.nombre}`}
              onClick={() => { const mp4 = p.archivos.filter((a) => /.mp4$/i.test(a.nombre)); setError(null); setPedido({ proyectoId: p.proyectoId, mp4s: "todos", texto: `Se van a la Papelera ${cuantos(mp4.length)} (${formatoTamano(mp4.reduce((t, a) => t + a.tamano, 0))}).` }); }}>
              <Trash2 size={13} aria-hidden="true" />Borrar todos
            </button>
          </div>
          <ul className="rejilla-exportados">
            {p.archivos.map((a) => (
              <li key={a.nombre} className="exportado">
                {a.portada ? <img className="portada" src={window.reels!.urlExportado(p.proyectoId, a.portada)} alt="" /> : <span className="portada vacia" aria-hidden="true" />}
                {formatoDeArchivo(a.nombre) && <span className="etiqueta-formato">{formatoDeArchivo(a.nombre)}</span>}
                <span className="nombre" title={a.nombre}>{a.nombre}</span>
                <span className="tenue">{(a.tamano / 1e6).toFixed(1)} MB</span>
                <button type="button" className="btn-icono borrar-reel" aria-label={`Borrar ${a.nombre}`}
                  onClick={() => { setError(null); setPedido({ proyectoId: p.proyectoId, mp4s: [a.nombre], texto: "¿Mandar este reel a la Papelera?" }); }}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {pedido && (
        <div className="confirmar-borrado" role="alertdialog" aria-label="Borrar reels">
          <p>{pedido.texto}</p>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="fila">
            <button type="button" className="btn peligro" disabled={borrando} onClick={() => void borrar()}>
              {borrando ? <LoaderCircle size={14} className="girar" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}Sí, borrar
            </button>
            <button type="button" className="btn fantasma" onClick={() => setPedido(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}
