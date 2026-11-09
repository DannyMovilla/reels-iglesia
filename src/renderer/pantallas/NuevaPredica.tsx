import { useEffect, useRef, useState } from "react";
import { Download, Film, Flag, FlagTriangleRight, Link2, LoaderCircle } from "lucide-react";
import type { Analisis, Proyecto, VideoOrigen } from "@shared/tipos";
import { limpiarAnalisis, OpcionesAnalisis } from "../componentes/OpcionesAnalisis";
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
  const [analisis, setAnalisis] = useState<Analisis>({ duracion: "normal" });
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [errorVideo, setErrorVideo] = useState<string | null>(null);
  const reproductor = useRef<HTMLVideoElement>(null);
  const [origen, setOrigen] = useState<"archivo" | "enlace">("archivo");
  const [enlace, setEnlace] = useState("");
  const [descarga, setDescarga] = useState<number | null>(null);
  const descargando = useRef(false);
  useEffect(() => () => {
    if (descargando.current) void window.reels?.cancelarDescarga?.();
  }, []);
  const enlaceValido = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(enlace.trim());

  const error = video ? validarRango(leerTiempo(inicio), leerTiempo(fin), video.duracion) : null;

  const limpiar = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

  const usarVideo = (v: VideoOrigen) => {
    setVideo(v);
    setInicio("0:00:00");
    setFin(tiempoConHoras(v.duracion));
  };

  async function elegir() {
    setErrorVideo(null);
    let v: VideoOrigen | null | undefined;
    try {
      v = await window.reels?.elegirVideo();
    } catch (e) {
      setErrorVideo(limpiar(e));
      return;
    }
    if (v) usarVideo(v);
  }

  async function descargar() {
    setErrorVideo(null);
    setDescarga(0);
    descargando.current = true;
    const quitar = window.reels!.alProgresoDescarga((p) => setDescarga(p));
    try {
      usarVideo(await window.reels!.descargarVideo(enlace.trim()));
    } catch (e) {
      setErrorVideo(limpiar(e));
    } finally {
      quitar();
      descargando.current = false;
      setDescarga(null);
    }
  }

  async function procesar() {
    if (!video || error) return;
    setCreando(true);
    setErrorCrear(null);
    try {
      const p = await window.reels!.crearProyecto({ nombre: nombre.trim() || nombrePorDefecto(), video, rango: { inicio: leerTiempo(inicio), fin: leerTiempo(fin) }, predicador: predicador.trim() || undefined, analisis: limpiarAnalisis(analisis) });
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
        <>
          <div className="pestanas origen" role="tablist" aria-label="De dónde viene el video">
            <button type="button" role="tab" aria-selected={origen === "archivo"} onClick={() => setOrigen("archivo")}><Film size={14} aria-hidden="true" />Archivo</button>
            <button type="button" role="tab" aria-selected={origen === "enlace"} onClick={() => setOrigen("enlace")}><Link2 size={14} aria-hidden="true" />Enlace</button>
          </div>
          {origen === "archivo" ? (
            <button type="button" className="zona-video" onClick={() => void elegir()}>
              <Film size={28} aria-hidden="true" />
              <b>Elige el video del culto</b>
              <span>MP4 o MOV. El video no se copia ni se sube: se usa desde donde está.</span>
            </button>
          ) : (
            <div className="zona-enlace">
              <label className="campo">
                <span>Enlace del video del culto</span>
                <input className="entrada" value={enlace} placeholder="https://www.facebook.com/…/videos/…" disabled={descarga !== null}
                  onChange={(e) => setEnlace(e.target.value)} />
              </label>
              <p className="ayuda">Facebook, YouTube y otras páginas. Solo videos que la iglesia tiene permiso de usar. Se guarda en la carpeta de Reels Iglesia.</p>
              {descarga === null ? (
                <button type="button" className="btn primario" disabled={!enlaceValido} onClick={() => void descargar()}><Download size={15} aria-hidden="true" />Descargar</button>
              ) : (
                <div className="fila">
                  <div className="barra-descarga" role="progressbar" aria-label="Descarga del video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={descarga}>
                    <i style={{ width: `${descarga}%` }} />
                  </div>
                  <span className="mono">{descarga.toFixed(0)} %</span>
                  <button type="button" className="btn pequeno fantasma" onClick={() => void window.reels!.cancelarDescarga()}>Cancelar descarga</button>
                </div>
              )}
            </div>
          )}
        </>
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
          <OpcionesAnalisis valor={analisis} alCambiar={setAnalisis} />
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
