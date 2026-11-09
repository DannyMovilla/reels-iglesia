import { useState } from "react";
import { Captions, FolderOpen, LoaderCircle } from "lucide-react";
import { Interruptor } from "./Inspector";

export const limpiarError = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

/** Una acción de la pestaña Entregas: botón, "trabajando…", archivo listo o error. */
export function useAccion() {
  const [trabajando, setTrabajando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const correr = async (f: () => Promise<string>) => {
    setTrabajando(true);
    setError(null);
    setListo(null);
    try {
      setListo(await f());
    } catch (e) {
      setError(limpiarError(e));
    } finally {
      setTrabajando(false);
    }
  };
  return { trabajando, listo, error, correr };
}

export function Resultado({ listo, error }: { listo: string | null; error: string | null }) {
  return (
    <>
      {listo && <p className="ayuda listo">Listo: {listo}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}

/** Lo que la prédica deja para la semana: subtítulos, PDF, MP3 y traducciones (en la carpeta de exportados). */
export function Entregas({ proyectoId }: { proyectoId: string }) {
  const [completo, setCompleto] = useState(true);
  const srt = useAccion();
  return (
    <div className="entregas">
      <p className="ayuda">Todo se guarda en la carpeta de exportados de esta prédica.</p>
      <section className="entrega">
        <h3><Captions size={16} aria-hidden="true" />Subtítulos (SRT)</h3>
        <p className="ayuda">Para subir con el video completo a YouTube o Facebook.</p>
        <div className="fila">
          <Interruptor activo={completo} etiqueta="Tiempos del video completo" alCambiar={setCompleto} />
          {completo ? "Tiempos del video completo del culto" : "Tiempos solo de la prédica"}
        </div>
        <div className="fila">
          <button type="button" className="btn" disabled={srt.trabajando} onClick={() => void srt.correr(() => window.reels!.crearSrt(proyectoId, { completo }))}>
            {srt.trabajando && <LoaderCircle size={15} className="girar" aria-hidden="true" />}Crear SRT
          </button>
        </div>
        <Resultado listo={srt.listo} error={srt.error} />
      </section>
      <button type="button" className="btn fantasma" onClick={() => void window.reels!.abrirCarpetaExportados(proyectoId)}>
        <FolderOpen size={15} aria-hidden="true" />Abrir carpeta
      </button>
    </div>
  );
}
