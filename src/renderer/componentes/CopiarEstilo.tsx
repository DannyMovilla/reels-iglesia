import { useState } from "react";
import { Check, Copy, LoaderCircle, Wand2 } from "lucide-react";
import { aplicarReferencia, type EstiloReferencia } from "@shared/estilo-referencia";
import { NOMBRE_LOOK } from "@shared/reel/color";
import { NOMBRE_ESTILO } from "@shared/reel/estilos-sub";
import { FUENTES } from "@shared/reel/fuentes";
import type { ClipSpec } from "@shared/tipos";
import { NOMBRE_ANIMO } from "../pantallas/Musica";

const limpiar = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const INTENSIDAD = { suave: "Suave", normal: "Normal", fuerte: "Fuerte" } as const;
const TAMANO = { s: "Chico", m: "Mediano", l: "Grande" } as const;

/** «Copiar el estilo de un reel»: la persona elige un video que le gusta y Claude propone un estilo parecido. */
export function CopiarEstilo({ clip, alAplicar, alGuardarEstilo }: { clip: ClipSpec; alAplicar(c: ClipSpec): void; alGuardarEstilo?(c: ClipSpec): void }) {
  const [analizando, setAnalizando] = useState(false);
  const [propuesta, setPropuesta] = useState<{ estilo: EstiloReferencia; avisos: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const analizar = async () => {
    setAnalizando(true);
    setError(null);
    setHecho(null);
    try {
      const r = await window.reels!.copiarEstilo(clip);
      if (r) setPropuesta(r);
    } catch (e) {
      setError(limpiar(e));
    } finally {
      setAnalizando(false);
    }
  };

  const e = propuesta?.estilo;
  return (
    <div className="grupo copiar-estilo"><h3>Copiar el estilo de un reel</h3>
      <p className="ayuda">Elige un reel que te guste (MP4 o MOV). Claude mira algunos cuadros y propone un estilo parecido con las opciones de la app.</p>
      <button type="button" className="btn pequeno" disabled={analizando} onClick={() => void analizar()}>
        {analizando ? <LoaderCircle size={13} className="girar" aria-hidden="true" /> : <Wand2 size={13} aria-hidden="true" />}
        {analizando ? "Analizando el estilo…" : "Elegir un reel de referencia"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      {e && (
        <div className="propuesta" aria-label="Estilo propuesto">
          <p>{e.explicacion}</p>
          <ul>
            <li>Subtítulos: {NOMBRE_ESTILO[e.subtitulos]}, {TAMANO[e.tamano].toLowerCase()}, al {Math.round(e.altura * 100)} % del alto</li>
            <li>Fuentes: {FUENTES[e.fuenteTitulos].nombre} (títulos) y {FUENTES[e.fuenteSubtitulos].nombre} (subtítulos)</li>
            <li>Música: {NOMBRE_ANIMO[e.animo]} · Cortes: {INTENSIDAD[e.intensidad]} · Color: {NOMBRE_LOOK[e.look]}</li>
          </ul>
          {propuesta!.avisos.map((a) => <p key={a} className="ayuda">{a}</p>)}
          <div className="fila">
            <button type="button" className="btn pequeno primario" onClick={() => { alAplicar(aplicarReferencia(clip, e)); setHecho("Listo, el estilo se aplicó a este clip."); }}>
              <Check size={13} aria-hidden="true" />Aplicar a este clip
            </button>
            {alGuardarEstilo && (
              <button type="button" className="btn pequeno" onClick={() => { alGuardarEstilo(aplicarReferencia(clip, e)); setHecho("Listo, se guardó como estilo de la iglesia."); }}>
                <Copy size={13} aria-hidden="true" />Guardar como estilo de la iglesia
              </button>
            )}
          </div>
        </div>
      )}
      {hecho && <p className="ayuda" role="status">{hecho}</p>}
    </div>
  );
}
