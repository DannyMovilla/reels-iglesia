import { useEffect, useRef, useState } from "react";
import { alCambiar, enCurso, lanzar } from "../enCurso";
import { Captions, FileText, FolderOpen, Languages, LoaderCircle, Music } from "lucide-react";
import type { NivelVoz } from "@shared/tipos";
import { Interruptor, Segmentos } from "./Inspector";
import { FrasesPublicar } from "./FrasesPublicar";

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

/** Idiomas de la traducción (los mismos códigos del proceso principal). */
const IDIOMAS: Record<string, string> = { en: "Inglés", pt: "Portugués", fr: "Francés", it: "Italiano", de: "Alemán", ko: "Coreano", zh: "Chino" };

/** Lo que la prédica deja para la semana: subtítulos, PDF, MP3, traducciones y frases (en la carpeta de exportados). */
export function Entregas({ proyectoId, alIrA, videoDisponible }: { proyectoId: string; alIrA?(t: number): void; videoDisponible?: boolean }) {
  const [completo, setCompleto] = useState(true);
  const srt = useAccion();
  const pdf = useAccion();
  const mp3 = useAccion();
  const [nivel, setNivel] = useState<NivelVoz>("limpia");
  const traduccion = useAccion();
  const [idiomas, setIdiomas] = useState<string[]>([]);
  // La traducción vive fuera del componente: si se sale de Entregas y se vuelve, sigue su progreso y se puede cancelar.
  const clave = `traducir:${proyectoId}`;
  const [progreso, setProgreso] = useState<string | null>(() => enCurso(clave)?.progreso ?? null);
  const oyente = useRef<() => void>(() => {});
  const seguir = (promesa: Promise<string[]>) => {
    oyente.current();
    oyente.current = alCambiar(clave, setProgreso);
    return traduccion.correr(async () => (await promesa).join(", "));
  };
  useEffect(() => {
    const ya = enCurso<string[]>(clave);
    if (ya) void seguir(ya.promesa);
    return () => oyente.current();
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  const traducir = () => seguir(lanzar(clave, async (alProgreso) => {
    const quitar = window.reels!.alProgresoEntregas((t) => alProgreso(t));
    try {
      return await window.reels!.traducirSrt(proyectoId, idiomas, { completo });
    } finally {
      quitar();
    }
  }));
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
      <section className="entrega">
        <h3><Languages size={16} aria-hidden="true" />Subtítulos traducidos</h3>
        <p className="ayuda">Claude traduce los subtítulos con los mismos tiempos que elegiste arriba para el SRT. Los versículos van en una versión reconocida de cada idioma.</p>
        <div className="idiomas" role="group" aria-label="Idiomas">
          {Object.entries(IDIOMAS).map(([codigo, nombre]) => (
            <label key={codigo} className="opcion">
              <input type="checkbox" checked={idiomas.includes(codigo)} disabled={traduccion.trabajando}
                onChange={(e) => setIdiomas((x) => (e.target.checked ? [...x, codigo] : x.filter((y) => y !== codigo)))} />
              {nombre}
            </label>
          ))}
        </div>
        <div className="fila">
          <button type="button" className="btn" disabled={!idiomas.length || traduccion.trabajando} onClick={() => void traducir()}>
            {traduccion.trabajando && <LoaderCircle size={15} className="girar" aria-hidden="true" />}Traducir
          </button>
          {traduccion.trabajando && <button type="button" className="btn pequeno fantasma" onClick={() => void window.reels!.cancelarTraduccion(proyectoId)}>Cancelar</button>}
          {progreso && <span className="ayuda" role="status">{progreso}</span>}
        </div>
        <Resultado listo={traduccion.listo} error={traduccion.error} />
      </section>
      <FrasesPublicar proyectoId={proyectoId} alIrA={alIrA} videoDisponible={videoDisponible} />
      <button type="button" className="btn fantasma" onClick={() => void window.reels!.abrirCarpetaExportados(proyectoId)}>
        <FolderOpen size={15} aria-hidden="true" />Abrir carpeta
      </button>
    </div>
  );
}
