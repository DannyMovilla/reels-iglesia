import { useEffect, useState } from "react";
import { Check, Copy, ListOrdered, LoaderCircle } from "lucide-react";
import { textoYoutube, type Capitulos as TCapitulos } from "@shared/capitulos";
import { Interruptor } from "./Inspector";

const limpiarError = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

/** Resumen y capítulos de la prédica para pegar en la descripción de YouTube. */
export function Capitulos({ proyectoId, inicioRango }: { proyectoId: string; inicioRango: number }) {
  const [caps, setCaps] = useState<TCapitulos | null | undefined>(undefined);
  const [completo, setCompleto] = useState(true);
  const [texto, setTexto] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => { void window.reels!.leerCapitulos(proyectoId).then(setCaps).catch(() => setCaps(null)); }, [proyectoId]);
  useEffect(() => { if (caps) setTexto(textoYoutube(caps, { completo, inicioRango })); }, [caps, completo, inicioRango]);

  const crear = async () => {
    setCreando(true);
    setError(null);
    try {
      setCaps(await window.reels!.crearCapitulos(proyectoId));
    } catch (e) {
      setError(limpiarError(e));
    } finally {
      setCreando(false);
    }
  };

  const copiar = async () => {
    await navigator.clipboard?.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  if (caps === undefined) return <div className="cargando">Cargando…</div>;
  return (
    <div className="capitulos">
      <p className="ayuda">Claude lee la prédica y escribe un resumen y los capítulos para la descripción del video en YouTube. Al exportar se guarda también «capitulos.txt».</p>
      {caps && (
        <>
          <div className="fila">
            <Interruptor activo={completo} etiqueta="Tiempos del video completo" alCambiar={setCompleto} />
            {completo ? "Tiempos del video completo del culto" : "Tiempos solo de la prédica"}
          </div>
          <textarea className="entrada mono" rows={12} aria-label="Texto para YouTube" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="fila">
        {caps && (
          <button type="button" className="btn" onClick={() => void copiar()}>
            {copiado ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copiado ? "Copiado" : "Copiar"}
          </button>
        )}
        <button type="button" className={`btn ${caps ? "fantasma" : "primario"}`} disabled={creando} onClick={() => void crear()}>
          {creando ? <LoaderCircle size={15} className="girar" aria-hidden="true" /> : <ListOrdered size={15} aria-hidden="true" />}
          {creando ? "Claude está leyendo la prédica…" : caps ? "Crear de nuevo" : "Crear capítulos"}
        </button>
      </div>
    </div>
  );
}
