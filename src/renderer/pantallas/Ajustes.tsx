import { useCallback, useEffect, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, RefreshCw } from "lucide-react";
import type { Chequeo, EstadoSistema } from "@shared/api";

const NOMBRES: Record<keyof EstadoSistema, string> = {
  ffmpeg: "FFmpeg (video)",
  python: "Python y modelos de transcripción",
  gpu: "Tarjeta de video",
  claude: "Claude (análisis de la prédica)",
};

const TEXTO_ACCION: Record<NonNullable<Chequeo["accion"]>, string> = {
  "iniciar-sesion-claude": "Iniciar sesión en Claude",
  "crear-venv": "Preparar Python",
  "instalar-ffmpeg": "Instalar FFmpeg",
};

export function Ajustes() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [revisando, setRevisando] = useState(false);

  const revisar = useCallback(async () => {
    setRevisando(true);
    try {
      setEstado((await window.reels?.verificarSistema()) ?? null);
    } finally {
      setRevisando(false);
    }
  }, []);

  useEffect(() => {
    void revisar();
  }, [revisar]);

  return (
    <section className="pantalla" aria-labelledby="t-ajustes">
      <div className="pantalla-cabeza">
        <h1 id="t-ajustes">Ajustes</h1>
        <button type="button" className="btn" onClick={() => void revisar()} disabled={revisando}>
          {revisando ? <LoaderCircle size={16} className="girar" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
          Volver a revisar
        </button>
      </div>
      <p className="ayuda">Reels Iglesia necesita estas piezas en tu computadora. Si alguna falta, aquí te decimos qué hacer.</p>
      <ul className="chequeos">
        {(Object.keys(NOMBRES) as (keyof EstadoSistema)[]).map((k) => {
          const c = estado?.[k];
          return (
            <li key={k} className={`chequeo ${c ? (c.ok ? "ok" : "mal") : ""}`}>
              <span className="chequeo-icono" aria-hidden="true">
                {!c ? <LoaderCircle size={18} className="girar" /> : c.ok ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
              </span>
              <div>
                <b>{NOMBRES[k]}</b>
                <span>{c ? c.detalle : "Revisando…"}</span>
              </div>
              {c?.accion && (
                <button type="button" className="btn primario" onClick={() => void window.reels?.accionSistema(c.accion!)}>
                  {TEXTO_ACCION[c.accion]}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
