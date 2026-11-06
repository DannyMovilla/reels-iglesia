import { useEffect, useRef, useState } from "react";
import { Film, Flag, FlagTriangleRight, LoaderCircle } from "lucide-react";
import type { Proyecto, VideoOrigen } from "@shared/tipos";
import { formatoTiempo, leerTiempo, tiempoConHoras, validarRango } from "@shared/validar";

interface Props {
  videoInicial?: VideoOrigen;
  alCrear(p: Proyecto): void;
  alCancelar(): void;
}

const nombrePorDefecto = () =>
  `Culto dominical · ${new Date().toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}`;

export function NuevaPredica({ videoInicial, alCrear, alCancelar }: Props) {
  const [video, setVideo] = useState<VideoOrigen | null>(videoInicial ?? null);
  const [nombre, setNombre] = useState(nombrePorDefecto);
  const [predicador, setPredicador] = useState("");
  useEffect(() => {
    void window.reels?.leerMarca?.().then((m) => setPredicador((p) => p || m.predicador || "")).catch(() => {});
  }, []);
  const [inicio, setInicio] = useState("0:00:00");
  const [fin, setFin] = useState(videoInicial ? tiempoConHoras(videoInicial.duracion) : "");
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [errorVideo, setErrorVideo] = useState<string | null>(null);
  const reproductor = useRef<HTMLVideoElement>(null);

  const error = video ? validarRango(leerTiempo(inicio), leerTiempo(fin), video.duracion) : null;

  const limpiar = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

  async function elegir() {
    setErrorVideo(null);
    let v: VideoOrigen | null | undefined;
    try {
      v = await window.reels?.elegirVideo();
    } catch (e) {
      setErrorVideo(limpiar(e));
      return;
    }
    if (!v) return;
    setVideo(v);
    setInicio("0:00:00");
    setFin(tiempoConHoras(v.duracion));
  }

  async function procesar() {
    if (!video || error) return;
    setCreando(true);
    setErrorCrear(null);
    try {
      const p = await window.reels!.crearProyecto({ nombre: nombre.trim() || nombrePorDefecto(), video, rango: { inicio: leerTiempo(inicio), fin: leerTiempo(fin) }, predicador: predicador.trim() || undefined });
      await window.reels!.procesar(p.id);
      alCrear(p);
    } catch (e) {
      setErrorCrear(limpiar(e));
      setCreando(false);
    }
  }

  const marcar = (cual: "inicio" | "fin") => {
    const t = reproductor.current?.currentTime ?? 0;
    (cual === "inicio" ? setInicio : setFin)(tiempoConHoras(t));
  };

  return (
    <section className="pantalla" aria-labelledby="t-nueva">
      <div className="pantalla-cabeza">
        <h1 id="t-nueva">Nueva prédica</h1>
        <button type="button" className="btn fantasma" onClick={alCancelar}>Cancelar</button>
      </div>

      {errorVideo && <p className="error" role="alert">{errorVideo}</p>}
      {!video ? (
        <button type="button" className="zona-video" onClick={() => void elegir()}>
          <Film size={28} aria-hidden="true" />
          <b>Elige el video del culto</b>
          <span>MP4 o MOV. El video no se copia ni se sube: se usa desde donde está.</span>
        </button>
      ) : (
        <>
          <div className="video-elegido">
            <video ref={reproductor} src={window.reels?.urlArchivo(video.ruta)} controls preload="metadata" />
            <div className="meta-video">
              <span className="mono">{video.ruta}</span>
              <span>{formatoTiempo(video.duracion)} · {(video.tamano / 1e9).toFixed(2)} GB</span>
              <button type="button" className="btn" onClick={() => void elegir()}>Elegir otro</button>
            </div>
          </div>

          <p className="ayuda">Adelanta el video hasta donde empieza la prédica y toca «Marcar inicio aquí». Haz lo mismo con el final. Solo ese tramo se transcribe y se analiza.</p>
          <div className="campos-rango">
            <label className="campo">
              <span>Inicio de la prédica</span>
              <span className="fila">
                <input className="entrada mono" value={inicio} onChange={(e) => setInicio(e.target.value)} placeholder="1:44:44" aria-invalid={!!error} />
                <button type="button" className="btn" onClick={() => marcar("inicio")}><Flag size={14} aria-hidden="true" />Marcar inicio aquí</button>
              </span>
            </label>
            <label className="campo">
              <span>Fin de la prédica</span>
              <span className="fila">
                <input className="entrada mono" value={fin} onChange={(e) => setFin(e.target.value)} placeholder="2:32:35" aria-invalid={!!error} />
                <button type="button" className="btn" onClick={() => marcar("fin")}><FlagTriangleRight size={14} aria-hidden="true" />Marcar fin aquí</button>
              </span>
            </label>
          </div>
          {error && <p className="error" role="alert">{error}</p>}

          <label className="campo">
            <span>Nombre</span>
            <input className="entrada" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="campo">
            <span>Predicador (opcional)</span>
            <input className="entrada" value={predicador} placeholder="Aparece en un rótulo al inicio del reel" onChange={(e) => setPredicador(e.target.value)} />
          </label>
          {errorCrear && <p className="error" role="alert">{errorCrear}</p>}
          <div className="fila">
            <button type="button" className="btn primario" disabled={!!error || creando} onClick={() => void procesar()}>
              {creando && <LoaderCircle size={16} className="girar" aria-hidden="true" />}
              Procesar prédica
            </button>
            <span className="ayuda">Se transcribe, se busca al predicador y Claude elige los mejores momentos.</span>
          </div>
        </>
      )}
    </section>
  );
}
