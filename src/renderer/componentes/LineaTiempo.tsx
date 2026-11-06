import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { BookOpen, Captions, Contrast, EyeOff, Film, Flag, Layers } from "lucide-react";
import { ajustarCorte, DURACION_MINIMA } from "@shared/reel/cortes";
import { bloquesSubtitulos } from "@shared/reel/subtitulos";
import { partesDelReel, reelAVideo, type Palabra, type Parte } from "@shared/reel/tiempo";
import { ventanaVersiculo, type Ventana } from "@shared/reel/versiculo";
import type { ClipSpec } from "@shared/tipos";
import { formatoTiempo } from "@shared/validar";

interface Props {
  clip: ClipSpec;
  palabras: Palabra[];
  /** Tiempo del reel (no del video original). */
  tiempoActual: number;
  alBuscar(t: number): void;
  alCambiarCorte(inicio: number, fin: number): void;
  alAlternarReproduccion?(): void;
}

const conDecimal = (t: number) => `${formatoTiempo(t)}.${Math.floor((t % 1) * 10)}`;

export function LineaTiempo({ clip, palabras, tiempoActual, alBuscar, alCambiarCorte, alAlternarReproduccion }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [arrastre, setArrastre] = useState<{ borde: "inicio" | "fin"; delta: number } | null>(null);
  const carriles = useRef<HTMLDivElement>(null);

  const partes = useMemo(() => partesDelReel(clip, palabras), [clip, palabras]);
  const total = partes.reduce((a, p) => a + p.duracion, 0);
  const parteClip = partes.find((p) => p.tipo === "clip")!;
  const ventanas = useMemo(
    () => clip.versiculos.map((v) => ({ v, w: ventanaVersiculo(v, parteClip) })).filter((x): x is { v: ClipSpec["versiculos"][number]; w: Ventana } => x.w !== null),
    [clip.versiculos, parteClip],
  );
  const bloques = useMemo(() => (clip.subtitulos.activos ? bloquesSubtitulos(clip, palabras, partes) : []), [clip, palabras, partes]);
  const pct = (t: number) => `${(t / total) * 100}%`;
  const videoEnCabezal = tiempoActual >= parteClip.inicioReel && tiempoActual <= parteClip.inicioReel + parteClip.duracion
    ? reelAVideo(parteClip, tiempoActual) : null;

  function cortar(inicio: number, fin: number) {
    if (fin - inicio < DURACION_MINIMA) {
      setError("Un reel necesita al menos 5 segundos.");
      return;
    }
    setError(null);
    const r = ajustarCorte({ inicio, fin }, palabras);
    alCambiarCorte(r.inicio, r.fin);
  }

  function teclado(e: KeyboardEvent) {
    const paso = e.shiftKey ? 1 : 0.1;
    if (e.key === "ArrowRight") alBuscar(Math.min(total, tiempoActual + paso));
    else if (e.key === "ArrowLeft") alBuscar(Math.max(0, tiempoActual - paso));
    else if ((e.key === "i" || e.key === "I") && videoEnCabezal !== null) cortar(videoEnCabezal, clip.fin);
    else if ((e.key === "o" || e.key === "O") && videoEnCabezal !== null) cortar(clip.inicio, videoEnCabezal);
    else if (e.key === " ") alAlternarReproduccion?.();
    else return;
    e.preventDefault();
  }

  const tiempoEn = (clientX: number) => {
    const r = carriles.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total;
  };
  const empezarArrastre = (borde: "inicio" | "fin") => (e: PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const t0 = tiempoEn(e.clientX);
    setArrastre({ borde, delta: 0 });
    const mover = (ev: globalThis.PointerEvent) => setArrastre({ borde, delta: tiempoEn(ev.clientX) - t0 });
    const soltar = (ev: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      const d = tiempoEn(ev.clientX) - t0;
      setArrastre(null);
      if (borde === "inicio") cortar(clip.inicio + d, clip.fin);
      else cortar(clip.inicio, clip.fin + d);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const bloquePara = (p: Parte) => {
    if (p.tipo !== "clip" || !arrastre) return { izq: p.inicioReel, ancho: p.duracion };
    return arrastre.borde === "inicio"
      ? { izq: p.inicioReel + arrastre.delta, ancho: p.duracion - arrastre.delta }
      : { izq: p.inicioReel, ancho: p.duracion + arrastre.delta };
  };
  const marcas = Array.from({ length: Math.floor(total / 5) + 1 }, (_, i) => i * 5);

  return (
    <section className="linea-tiempo" aria-label="Línea de tiempo" tabIndex={0} onKeyDown={teclado}>
      <div className="lt-pistas">
        <div className="lt-etiquetas" aria-hidden="true">
          <div><Film size={13} />Video</div><div><Layers size={13} />Efectos</div><div><Captions size={13} />Subtítulos</div>
        </div>
        <div className="lt-carriles" ref={carriles} onPointerDown={(e) => alBuscar(tiempoEn(e.clientX))}>
          <div className="lt-regla">{marcas.map((m) => <span key={m} style={{ left: pct(m) }}>{formatoTiempo(m)}</span>)}</div>
          <div className="lt-carril video">
            {partes.map((p) => {
              const b = bloquePara(p);
              return (
                <div key={p.tipo} className={`lt-parte ${p.tipo}`} style={{ left: pct(b.izq), width: pct(b.ancho) }}>
                  {p.tipo === "clip" && (
                    <>
                      <span className="asa izq" role="slider" aria-label="Inicio del clip" aria-valuenow={clip.inicio} tabIndex={-1} onPointerDown={empezarArrastre("inicio")} />
                      <span className="asa der" role="slider" aria-label="Fin del clip" aria-valuenow={clip.fin} tabIndex={-1} onPointerDown={empezarArrastre("fin")} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="lt-carril">
            {partes.filter((p) => p.tipo === "apertura").map((p) => (
              <div key="ap" className="lt-bloque bn" style={{ left: pct(p.inicioReel), width: pct(p.duracion) }}><Contrast size={11} aria-hidden="true" />Apertura B/N</div>
            ))}
            {ventanas.map(({ v, w }) => (
              <div key={v.ref} className="lt-bloque versiculo" style={{ left: pct(w.desde), width: pct(w.hasta - w.desde) }}><BookOpen size={11} aria-hidden="true" />{v.ref}</div>
            ))}
            {partes.filter((p) => p.tipo === "cierre").map((p) => (
              <div key="ci" className="lt-bloque cierre" style={{ left: pct(p.inicioReel), width: pct(p.duracion) }}><Flag size={11} aria-hidden="true" />Cierre</div>
            ))}
          </div>
          <div className="lt-carril">
            {bloques.map((b, i) => (
              <div key={i} className={`lt-sub${b.palabras.some((p) => p.clave) ? " clave" : ""}`} style={{ left: pct(b.desde), width: pct(Math.max(0.1, b.hasta - b.desde)) }} />
            ))}
            {ventanas.map(({ v, w }) => (
              <div key={v.ref} className="lt-oculto" style={{ left: pct(w.desde), width: pct(w.hasta - w.desde) }}><EyeOff size={11} aria-hidden="true" />ocultos por la cita</div>
            ))}
          </div>
          <div className="lt-cabezal" style={{ left: pct(tiempoActual) }} aria-hidden="true" />
        </div>
      </div>
      <div className="lt-pie">
        <span>Inicio <b className="mono">{conDecimal(clip.inicio)}</b></span>
        <span>Fin <b className="mono">{conDecimal(clip.fin)}</b></span>
        <span>Duración <b className="mono">{conDecimal(clip.fin - clip.inicio)}</b></span>
        {error && <span className="error" role="alert">{error}</span>}
        <span className="espacio" />
        <span className="ayuda-lt">Arrastra los bordes dorados o usa I / O para marcar inicio y fin · ←/→ mueven el cabezal</span>
      </div>
    </section>
  );
}
