import type { Analisis } from "@shared/tipos";
import { Segmentos } from "./Inspector";

export const MAX_INSTRUCCION = 300;

/** Instrucción para Claude (opcional) y duración de los clips: al crear la prédica y al "Analizar de nuevo". */
export function OpcionesAnalisis({ valor, alCambiar }: { valor: Analisis; alCambiar(a: Analisis): void }) {
  const instruccion = valor.instruccion ?? "";
  return (
    <div className="opciones-analisis">
      <div className="campo">Duración de los clips
        <Segmentos etiqueta="Duración de los clips" valor={valor.duracion}
          opciones={[["corta", "Cortos · 15–30 s"], ["normal", "Normales · 30–60 s"], ["larga", "Largos · 60–90 s"]]}
          alCambiar={(duracion) => alCambiar({ ...valor, duracion })} />
      </div>
      <label className="campo">
        <span className="campo-cabeza">Instrucción para Claude (opcional) <span className="mono">{instruccion.length}/{MAX_INSTRUCCION}</span></span>
        <textarea className="entrada" rows={2} maxLength={MAX_INSTRUCCION} aria-label="Instrucción para Claude (opcional)"
          placeholder="Por ejemplo: prioriza lo que habla de la ansiedad" value={instruccion}
          onChange={(e) => alCambiar({ ...valor, instruccion: e.target.value || undefined })} />
      </label>
    </div>
  );
}

/** Lo que se guarda: sin instrucción vacía. */
export const limpiarAnalisis = (a: Analisis): Analisis => {
  const instruccion = a.instruccion?.trim().slice(0, MAX_INSTRUCCION);
  return instruccion ? { duracion: a.duracion, instruccion } : { duracion: a.duracion };
};
