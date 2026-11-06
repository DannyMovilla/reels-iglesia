import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import "@hyperframes/player";
import { Scan, Smartphone } from "lucide-react";
import { ALTOS, construirComposicion } from "@shared/reel/composicion";
import { urlLogoVista } from "../pantallas/Marca";
import type { Caras, ClipSpec, Formato, Marca, Transcripcion } from "@shared/tipos";

export interface ControlVistaPrevia {
  seek(t: number): void;
  play(): void;
  pause(): void;
  alternar(): void;
}

interface Props {
  proyectoId: string;
  clip: ClipSpec;
  transcripcion: Transcripcion;
  caras: Caras | null;
  marca: Marca;
  dimensiones: { ancho: number; alto: number };
  alTiempo?(t: number): void;
  alAvisos?(avisos: string[]): void;
}

interface Reproductor extends HTMLElement {
  seek(t: number): void;
  play(): void;
  pause(): void;
  currentTime: number;
}

let version = 0;

/** Vista previa en vivo: la misma composición que se exporta, servida por reels-comp:// (prueba técnica D1). */
export const VistaPrevia = forwardRef<ControlVistaPrevia, Props>(function VistaPrevia(p, ref) {
  const [formato, setFormato] = useState<Formato>("9:16");
  const [zonaSegura, setZonaSegura] = useState(true);
  const [src, setSrc] = useState<string | null>(null);
  const reproductor = useRef<Reproductor | null>(null);
  const tiempo = useRef(0);

  useImperativeHandle(ref, () => ({
    seek: (t) => reproductor.current?.seek(t),
    play: () => reproductor.current?.play(),
    pause: () => reproductor.current?.pause(),
    alternar: () => {
      const r = reproductor.current as (Reproductor & { paused?: boolean }) | null;
      if (r?.paused === false) r.pause();
      else r?.play();
    },
  }), []);

  useEffect(() => {
    const espera = setTimeout(async () => {
      const comp = construirComposicion({
        clip: p.clip, transcripcion: p.transcripcion, caras: p.caras, marca: p.marca, formato, dimensiones: p.dimensiones,
        fuenteVideo: window.reels!.urlVideo(p.proyectoId),
        recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", runtime: "recursos/hyperframe.runtime.iife.js", logo: urlLogoVista(p.marca.logo) },
        modo: "vista",
      });
      p.alAvisos?.(comp.avisos);
      setSrc(await window.reels!.registrarVista(`vista-${++version}`, comp.html));
    }, 300);
    return () => clearTimeout(espera);
  }, [p.clip, p.transcripcion, p.caras, p.marca, p.dimensiones, p.proyectoId, formato]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al recargar la composición, vuelve al mismo segundo.
  useEffect(() => {
    const el = reproductor.current;
    if (!el || !src) return;
    const alListo = () => el.seek(tiempo.current);
    const alTiempo = (e: Event) => {
      const t = (e as CustomEvent<{ currentTime: number }>).detail?.currentTime ?? el.currentTime;
      tiempo.current = t;
      p.alTiempo?.(t);
    };
    el.addEventListener("ready", alListo);
    el.addEventListener("timeupdate", alTiempo);
    return () => {
      el.removeEventListener("ready", alListo);
      el.removeEventListener("timeupdate", alTiempo);
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  const alto = ALTOS[formato];
  return (
    <div className="vista-previa">
      <div className="vista-barra">
        <div className="seg" role="group" aria-label="Formato">
          {(["9:16", "4:5", "1:1"] as Formato[]).map((f) => (
            <button key={f} type="button" aria-pressed={formato === f} onClick={() => setFormato(f)}>
              {f === "9:16" && <Smartphone size={13} aria-hidden="true" />}{f}
            </button>
          ))}
        </div>
        <button type="button" className="btn pequeno fantasma" aria-pressed={zonaSegura} onClick={() => setZonaSegura(!zonaSegura)}>
          <Scan size={14} aria-hidden="true" />Zona segura
        </button>
      </div>
      <div className="pantalla-reel" style={{ aspectRatio: `1080 / ${alto}` }}>
        {src && <hyperframes-player ref={reproductor as never} src={src} width={1080} height={alto} controls />}
        {zonaSegura && formato === "9:16" && (
          <div className="zona-segura" aria-hidden="true">
            <div className="zs-arriba" /><div className="zs-derecha" /><div className="zs-abajo" />
            <span>Instagram tapa esta zona</span>
          </div>
        )}
      </div>
    </div>
  );
});
