import { useState } from "react";
import { Captions, FileText, FolderOpen, LoaderCircle, Music } from "lucide-react";
import type { NivelVoz } from "@shared/tipos";
import { Interruptor, Segmentos } from "./Inspector";

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
  const pdf = useAccion();
  const mp3 = useAccion();
  const [nivel, setNivel] = useState<NivelVoz>("limpia");
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
      <section className="entrega">
        <h3><FileText size={16} aria-hidden="true" />Transcripción en PDF</h3>
        <p className="ayuda">Para estudios de célula: el texto de la prédica en párrafos, con el resumen y los capítulos si ya los creaste.</p>
        <div className="fila">
          <button type="button" className="btn" disabled={pdf.trabajando} onClick={() => void pdf.correr(() => window.reels!.crearPdf(proyectoId))}>
            {pdf.trabajando && <LoaderCircle size={15} className="girar" aria-hidden="true" />}Crear PDF
          </button>
        </div>
        <Resultado listo={pdf.listo} error={pdf.error} />
      </section>
      <section className="entrega">
        <h3><Music size={16} aria-hidden="true" />Prédica en MP3</h3>
        <p className="ayuda">Para un podcast o para compartir por WhatsApp: al volumen de los podcasts, con el título, el predicador y el logo.</p>
        <Segmentos<NivelVoz> etiqueta="Voz del MP3" valor={nivel} opciones={[["ligera", "Ligera"], ["limpia", "Limpia"], ["podcast", "Podcast"]] as [NivelVoz, string][]} alCambiar={setNivel} />
        <div className="fila">
          <button type="button" className="btn" disabled={mp3.trabajando} onClick={() => void mp3.correr(() => window.reels!.crearMp3(proyectoId, nivel))}>
            {mp3.trabajando && <LoaderCircle size={15} className="girar" aria-hidden="true" />}Crear MP3
          </button>
          {mp3.trabajando && <span className="ayuda">Puede tardar unos minutos con una prédica larga.</span>}
        </div>
        <Resultado listo={mp3.listo} error={mp3.error} />
      </section>
      <button type="button" className="btn fantasma" onClick={() => void window.reels!.abrirCarpetaExportados(proyectoId)}>
        <FolderOpen size={15} aria-hidden="true" />Abrir carpeta
      </button>
    </div>
  );
}
