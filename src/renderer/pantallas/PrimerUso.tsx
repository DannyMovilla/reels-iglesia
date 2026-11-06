import { useCallback, useEffect, useState } from "react";
import type { Chequeo, EstadoSistema } from "@shared/api";
import { Chequeos } from "../componentes/Chequeos";

/** Revisar y arreglar lo que necesita la app (también lo usa Ajustes). */
export function useSistema() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [enCurso, setEnCurso] = useState<{ accion: string; pct: number; texto?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revisar = useCallback(async (claude = false) => {
    setEstado((await window.reels?.verificarSistema(claude ? { claude: true } : undefined)) ?? null);
  }, []);

  useEffect(() => { void revisar(); }, [revisar]);

  const accion = async (a: NonNullable<Chequeo["accion"]>) => {
    setError(null);
    if (a === "comprobar-claude") {
      setEnCurso({ accion: a, pct: 50, texto: "Preguntando a Claude…" });
      await revisar(true);
      setEnCurso(null);
      return;
    }
    setEnCurso({ accion: a, pct: 0 });
    const quitar = window.reels!.alProgresoSistema((p) => setEnCurso({ accion: a, ...p }));
    try {
      await window.reels!.accionSistema(a);
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    } finally {
      quitar();
      setEnCurso(null);
      await revisar();
    }
  };

  return { estado, enCurso, error, revisar, accion };
}

/** Asistente de primer uso: aparece al abrir la app si falta algo; se puede saltar. */
export function PrimerUso({ alListo }: { alListo(): void }) {
  const { estado, enCurso, error, revisar, accion } = useSistema();
  const todoListo = !!estado && estado.python.ok && estado.ffmpeg.ok;
  return (
    <section className="pantalla primer-uso" aria-labelledby="t-primer-uso">
      <div className="pantalla-cabeza"><h1 id="t-primer-uso">Preparemos tu computadora</h1></div>
      <p className="ayuda">
        Reels Iglesia necesita estas piezas. Toca cada botón y la app lo instala sola; la primera vez descarga unos 3 GB (los modelos para
        transcribir), así que conviene tener buen internet.
      </p>
      <Chequeos estado={estado} enCurso={enCurso} alAccion={(a) => void accion(a)} />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="fila">
        <button type="button" className="btn primario" disabled={!!enCurso} onClick={alListo}>{todoListo ? "Empezar" : "Saltar por ahora"}</button>
        <button type="button" className="btn fantasma" disabled={!!enCurso} onClick={() => void revisar()}>Comprobar de nuevo</button>
      </div>
    </section>
  );
}
