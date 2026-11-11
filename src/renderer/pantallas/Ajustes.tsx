import { Check, ClipboardCopy, Download, Eraser, FolderOpen, LoaderCircle, RefreshCw } from "lucide-react";
import { formatoTamano } from "@shared/tamano";
import { textoActualizacion } from "@shared/actualizacion";
import { useActualizacion } from "../actualizacion";
import { useEffect, useState } from "react";
import { Chequeos } from "../componentes/Chequeos";
import { useSistema } from "./PrimerUso";
import { Segmentos } from "../componentes/Inspector";
import { aplicarTema, leerPreferencia, type PreferenciaTema } from "../tema";

/** La versión instalada y las actualizaciones automáticas. */
function Version() {
  const estado = useActualizacion();
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => { void window.reels?.versionApp?.().then(setVersion); }, []);
  const ocupado = estado?.fase === "buscando" || estado?.fase === "descargando";
  return (
    <div className="grupo-ajuste">
      <h2>Versión</h2>
      {version && <p>Reels Iglesia {version}</p>}
      <div className="fila">
        <button type="button" className="btn" disabled={ocupado} onClick={() => void window.reels!.buscarActualizacion()}>
          {ocupado ? <LoaderCircle size={15} className="girar" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}Buscar actualizaciones
        </button>
        {estado && textoActualizacion(estado) && <span className={estado.fase === "error" ? "error" : "ayuda"} role="status">{textoActualizacion(estado)}</span>}
      </div>
    </div>
  );
}

/** Cuánto ocupa la app en Documentos y «Liberar espacio» (lo que se puede rehacer). */
function Espacio() {
  const [total, setTotal] = useState<number | null>(null);
  const [liberando, setLiberando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const medir = () => void window.reels?.espacioTotal?.().then(setTotal).catch(() => undefined);
  useEffect(medir, []);
  const liberar = async () => {
    setLiberando(true);
    setMensaje(null);
    try {
      const r = await window.reels!.liberarEspacio();
      const saltadas = r.saltadas ? ` ${r.saltadas === 1 ? "1 prédica se saltó porque está trabajando" : `${r.saltadas} prédicas se saltaron porque están trabajando`}.` : "";
      setMensaje(`Liberé ${formatoTamano(r.liberado)}.${saltadas}`);
      medir();
    } catch {
      setMensaje("No pude liberar espacio. Prueba de nuevo.");
    } finally {
      setLiberando(false);
    }
  };
  return (
    <div className="grupo-ajuste">
      <h2>Espacio</h2>
      {total !== null && <p>La app ocupa {formatoTamano(total)} en Documentos\Reels Iglesia (sin contar los videos de los cultos).</p>}
      <p className="ayuda">«Liberar espacio» borra lo que la app puede volver a hacer: archivos temporales y las voces de los niveles Ligera y Podcast de las prédicas cuyo video sigue en su lugar.</p>
      <div className="fila">
        <button type="button" className="btn" disabled={liberando} onClick={() => void liberar()}>
          {liberando ? <LoaderCircle size={15} className="girar" aria-hidden="true" /> : <Eraser size={15} aria-hidden="true" />}Liberar espacio
        </button>
        {mensaje && <span className="ayuda" role="status">{mensaje}</span>}
      </div>
    </div>
  );
}

/** «Copiar diagnóstico» y la carpeta de registros: lo que hace falta para pedir ayuda si algo falla. */
function Diagnostico() {
  const [estado, setEstado] = useState<"listo" | "copiando" | "copiado" | string>("listo");
  const copiar = async () => {
    setEstado("copiando");
    try {
      await navigator.clipboard.writeText(await window.reels!.diagnostico());
      setEstado("copiado");
      setTimeout(() => setEstado("listo"), 2000);
    } catch {
      setEstado("No pude copiar el diagnóstico. Prueba de nuevo.");
    }
  };
  return (
    <div className="grupo-ajuste">
      <h2>Diagnóstico</h2>
      <p className="ayuda">Si algo falla, copia el diagnóstico y mándaselo a quien te ayuda con la app. No se envía nada solo.</p>
      <div className="fila">
        <button type="button" className="btn" onClick={() => void copiar()} disabled={estado === "copiando"}>
          {estado === "copiando" ? <LoaderCircle size={15} className="girar" aria-hidden="true" /> : <ClipboardCopy size={15} aria-hidden="true" />}Copiar diagnóstico
        </button>
        <button type="button" className="btn fantasma" onClick={() => void window.reels!.abrirRegistros()}><FolderOpen size={15} aria-hidden="true" />Abrir carpeta de registros</button>
        {estado === "copiado" && <span className="ayuda listo" role="status"><Check size={14} aria-hidden="true" />Copiado</span>}
      </div>
      {estado !== "listo" && estado !== "copiando" && estado !== "copiado" && <p className="error" role="alert">{estado}</p>}
    </div>
  );
}

export function Ajustes() {
  const { estado, enCurso, error, revisar, accion, cancelar } = useSistema();
  const [revisando, setRevisando] = useState(false);
  const [tema, setTema] = useState<PreferenciaTema>(leerPreferencia);
  const volver = async () => {
    setRevisando(true);
    try {
      await revisar();
    } finally {
      setRevisando(false);
    }
  };
  return (
    <section className="pantalla" aria-labelledby="t-ajustes">
      <div className="pantalla-cabeza">
        <h1 id="t-ajustes">Ajustes</h1>
        <button type="button" className="btn" onClick={() => void volver()} disabled={revisando || !!enCurso}>
          {revisando ? <LoaderCircle size={16} className="girar" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
          Volver a revisar
        </button>
      </div>
      <p className="ayuda">Reels Iglesia necesita estas piezas en tu computadora. Si alguna falta, toca su botón y la app la instala.</p>
      <div className="grupo-ajuste">
        <h2>Apariencia</h2>
        <Segmentos<PreferenciaTema> etiqueta="Apariencia" valor={tema} opciones={[["oscuro", "Oscuro"], ["claro", "Claro"], ["sistema", "Como Windows"]]}
          alCambiar={(t) => { aplicarTema(t); setTema(t); }} />
      </div>
      <h2 className="subtitulo-ajustes">Lo que necesita la app</h2>
      <Chequeos estado={estado} enCurso={enCurso} alAccion={(a) => void accion(a)} alCancelar={cancelar} />
      {error && <p className="error" role="alert">{error}</p>}
      <Version />
      <Espacio />
      <Diagnostico />
    </section>
  );
}
