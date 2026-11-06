import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { Chequeo, EstadoSistema } from "@shared/api";

export const NOMBRES_CHEQUEO: Record<keyof EstadoSistema, string> = {
  python: "Python y modelos de transcripción",
  ffmpeg: "FFmpeg (video)",
  gpu: "Tarjeta de video",
  claude: "Claude (análisis de la prédica)",
};

export const TEXTO_ACCION: Record<NonNullable<Chequeo["accion"]>, string> = {
  "instalar-python": "Instalar Python",
  "crear-venv": "Preparar el entorno",
  "instalar-ffmpeg": "Instalar FFmpeg",
  "iniciar-sesion-claude": "Iniciar sesión en Claude",
  "comprobar-claude": "Comprobar",
};

interface Props {
  estado: EstadoSistema | null;
  /** Acción en curso (su fila muestra el progreso). */
  enCurso: { accion: string; pct: number; texto?: string } | null;
  alAccion(accion: NonNullable<Chequeo["accion"]>): void;
  /** Cancelar la acción en curso (preparar el entorno). */
  alCancelar?(): void;
}

/** Lista de lo que necesita la app, con el botón que lo arregla. */
export function Chequeos({ estado, enCurso, alAccion, alCancelar }: Props) {
  return (
    <ul className="chequeos">
      {(Object.keys(NOMBRES_CHEQUEO) as (keyof EstadoSistema)[]).map((k) => {
        const c = estado?.[k];
        const corriendo = c?.accion && enCurso?.accion === c.accion;
        return (
          <li key={k} className={`chequeo ${c ? (c.ok ? "ok" : "mal") : ""}`}>
            <span className="chequeo-icono" aria-hidden="true">
              {!c || corriendo ? <LoaderCircle size={18} className="girar" /> : c.ok ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
            </span>
            <div>
              <b>{NOMBRES_CHEQUEO[k]}</b>
              <span>{corriendo ? enCurso?.texto ?? "Trabajando…" : c ? c.detalle : "Revisando…"}</span>
              {corriendo && (
                <div className="barra-descarga" role="progressbar" aria-label={NOMBRES_CHEQUEO[k]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={enCurso!.pct}>
                  <i style={{ width: `${enCurso!.pct}%` }} />
                </div>
              )}
            </div>
            {corriendo && c?.accion === "crear-venv" && alCancelar && (
              <button type="button" className="btn pequeno fantasma" onClick={alCancelar}>Cancelar</button>
            )}
            {c?.accion && !corriendo && (
              <button type="button" className={`btn pequeno${c.ok ? " fantasma" : " primario"}`} disabled={!!enCurso} onClick={() => alAccion(c.accion!)}>
                {TEXTO_ACCION[c.accion]}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
