import { useEffect, useState } from "react";
import { Clapperboard, FolderOpen } from "lucide-react";

type Lista = Awaited<ReturnType<NonNullable<typeof window.reels>["listarExportados"]>>;

/** Todos los reels exportados, agrupados por prédica. */
export function Exportados() {
  const [lista, setLista] = useState<Lista | null>(null);
  useEffect(() => {
    const api = window.reels!;
    void api.listarExportados().then(setLista);
    return api.alCambiarTareas(() => void api.listarExportados().then(setLista));
  }, []);

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
          <div className="fila"><b>{p.nombre}</b><span className="espacio" />
            <button type="button" className="btn pequeno" onClick={() => void window.reels!.abrirCarpetaExportados(p.proyectoId)}><FolderOpen size={13} aria-hidden="true" />Abrir carpeta</button>
          </div>
          <ul className="rejilla-exportados">
            {p.archivos.map((a) => (
              <li key={a.nombre} className="exportado">
                {a.portada ? <img className="portada" src={window.reels!.urlExportado(p.proyectoId, a.portada)} alt="" /> : <span className="portada vacia" aria-hidden="true" />}
                <span className="nombre" title={a.nombre}>{a.nombre}</span>
                <span className="tenue">{(a.tamano / 1e6).toFixed(1)} MB</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
