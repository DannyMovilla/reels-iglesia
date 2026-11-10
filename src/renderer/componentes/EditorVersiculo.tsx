import { PINTURAS } from "@shared/reel/pinturas";
import { SelectorZona, ZonaSegura, type RedZona } from "./ZonaSegura";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "@hyperframes/player";
import { ArrowLeft, AudioLines, BookOpen, Check, Download, Image, ImagePlus, Send, TriangleAlert, Type } from "lucide-react";
import { ALTOS } from "@shared/reel/composicion";
import { ESCENAS } from "@shared/reel/escenas";
import { construirReelVersiculo } from "@shared/reel/versiculo-reel";
import { ANIMOS, type Animo, type Creacion, type Escena, type Formato, type Marca } from "@shared/tipos";
import { urlLogoVista } from "../pantallas/Marca";
import { NOMBRE_ANIMO } from "../pantallas/Musica";
import { ColaExportacion } from "./ColaExportacion";
import { Interruptor, Publicar, Segmentos } from "./Inspector";
import { PanelCategorias, type CategoriaRiel } from "./PanelCategorias";

/** Categorías del panel de Con IA (las mismas ideas que el editor de prédicas). */
type CatIA = "texto" | "versiculo" | "fondo" | "audio" | "publicar";
const CATEGORIAS_IA: CategoriaRiel<CatIA>[] = [
  { id: "texto", nombre: "Texto", titulo: "Texto", ayuda: "El gancho de los primeros segundos y la reflexión del final.", Icono: Type },
  { id: "versiculo", nombre: "Versículo", titulo: "Versículo", ayuda: "La referencia y el texto Reina-Valera 1960, que hay que confirmar.", Icono: BookOpen },
  { id: "fondo", nombre: "Fondo", titulo: "Fondo", ayuda: "Lo que se ve detrás del texto: escena, pintura, degradado o tu foto o video.", Icono: Image },
  { id: "audio", nombre: "Audio", titulo: "Audio", ayuda: "La música de fondo y los efectos de sonido.", Icono: AudioLines },
  { id: "publicar", nombre: "Publicar", titulo: "Publicar", ayuda: "Los formatos a exportar y el texto para cada red.", Icono: Send, separado: true },
];
let version = 0;

/** Editor del reel de un versículo: vista previa en vivo a la izquierda, datos a la derecha. */
export function EditorVersiculo({ creacion, error, alVolver }: { creacion: Creacion; error: string | null; alVolver(): void }) {
  const [c, setC] = useState(creacion);
  const [marca, setMarca] = useState<Marca | null>(null);
  const [cat, setCat] = useState<CatIA>(creacion.versiculo.confirmado ? "texto" : "versiculo");
  /** Hueco de la barra de arriba para «Exportar» (sin la barra, el botón queda en el panel). */
  const [barra, setBarra] = useState<HTMLElement | null>(null);
  useEffect(() => setBarra(document.getElementById("barra-acciones")), []);
  const [formato, setFormato] = useState<Formato>("9:16");
  const [zona, setZona] = useState<RedZona>("instagram");
  const [src, setSrc] = useState<string | null>(null);
  const [tareas, setTareas] = useState<Awaited<ReturnType<NonNullable<typeof window.reels>["tareas"]>>>([]);
  const [abierto] = useState(() => new Date().toISOString());
  const guardando = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendiente = useRef<Creacion | null>(null);

  useEffect(() => { void window.reels!.leerMarca().then(setMarca); }, []);
  useEffect(() => {
    void window.reels!.tareas().then(setTareas);
    return window.reels!.alCambiarTareas(setTareas);
  }, []);

  const guardarYa = async () => {
    if (guardando.current) clearTimeout(guardando.current);
    guardando.current = null;
    const x = pendiente.current;
    pendiente.current = null;
    if (x) await window.reels!.guardarCreacion(x);
  };
  const cambiar = (parcial: Partial<Creacion>) => {
    const nueva = { ...c, ...parcial };
    setC(nueva);
    pendiente.current = nueva;
    if (guardando.current) clearTimeout(guardando.current);
    guardando.current = setTimeout(() => void guardarYa(), 400);
  };

  // Vista previa en vivo (la misma composición que se exporta).
  useEffect(() => {
    if (!marca) return;
    const espera = setTimeout(async () => {
      const archivo = c.fondo.archivo?.split(/[\\/]/).pop();
      const fondoSrc = (c.fondo.tipo === "imagen" || c.fondo.tipo === "video") && archivo ? window.reels!.urlFondo(c.id, archivo) : undefined;
      const recursos = { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", runtime: "recursos/hyperframe.runtime.iife.js", logo: urlLogoVista(marca.logo), escenas: "recursos/escenas/shaders.iife.js", efectos: "recursos/efectos", pinturas: "recursos/pinturas" };
      const borrador = construirReelVersiculo({ creacion: c, marca, formato, recursos, modo: "vista", fondoSrc });
      const musica = await window.reels!.urlMusicaCreacion(c.id, borrador.duracion).catch(() => null);
      const comp = construirReelVersiculo({ creacion: c, marca, formato, recursos, modo: "vista", fondoSrc, fondoDuracion: 600, musica: musica ? { src: musica } : undefined });
      setSrc(await window.reels!.registrarVista(`ia-${++version}`, comp.html));
    }, 300);
    return () => clearTimeout(espera);
  }, [c, marca, formato]);

  const [pidiendo, setPidiendo] = useState(false);
  const [errorPedir, setErrorPedir] = useState<string | null>(null);
  const pedirOtraVez = async () => {
    setPidiendo(true);
    setErrorPedir(null);
    try {
      await guardarYa();
      setC(await window.reels!.escribirCreacion(c.id));
    } catch (e) {
      setErrorPedir((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    } finally {
      setPidiendo(false);
    }
  };

  const sinConfirmar = !c.versiculo.confirmado || !c.versiculo.texto.trim();
  const exportar = async () => {
    await guardarYa();
    await window.reels!.exportarCreacion(c.id, c.formatos);
  };
  const elegirFondo = async () => {
    const ruta = await window.reels!.elegirFondo(c.id);
    if (ruta) cambiar({ fondo: { tipo: /\.(mp4|mov|m4v|webm)$/i.test(ruta) ? "video" : "imagen", archivo: ruta } });
  };
  const alto = ALTOS[formato];
  const botonExportar = (
    <button type="button" className="btn primario" disabled={sinConfirmar || c.formatos.length === 0} onClick={() => void exportar()}
      title={sinConfirmar ? "Confirma el texto RVR1960 para poder exportar" : undefined}>
      <Download size={15} aria-hidden="true" />Exportar
    </button>
  );

  return (
    <div className="editor-ia">
      {barra && createPortal(botonExportar, barra)}
      <div className="ia-cabeza">
        <button type="button" className="btn fantasma pequeno" onClick={() => void guardarYa().then(alVolver)}><ArrowLeft size={14} aria-hidden="true" />Con IA</button>
        <h1>{c.versiculo.ref || c.entrada.texto}</h1>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="ia-cuerpo">
        <div className="ia-vista">
          <div className="vista-barra">
            <div className="seg" role="group" aria-label="Formato de la vista previa">
              {(["9:16", "4:5", "1:1"] as Formato[]).map((f) => <button key={f} type="button" aria-pressed={formato === f} onClick={() => setFormato(f)}>{f}</button>)}
            </div>
            <SelectorZona valor={zona} alCambiar={setZona} />
          </div>
          <div className="pantalla-reel" style={{ aspectRatio: `1080 / ${alto}` }}>
            <ZonaSegura red={zona} formato={formato} />
            {src && <hyperframes-player src={src} width={1080} height={alto} controls />}
          </div>
        </div>

        <div className="ia-panel">
          <PanelCategorias<CatIA> etiqueta="Ajustes del reel" actual={cat} alElegir={setCat}
            categorias={CATEGORIAS_IA.map((k) => (k.id === "versiculo" && !c.versiculo.confirmado ? { ...k, aviso: "Falta confirmar el texto" } : k))}>
            {cat === "texto" && (
              <>
                <label className="campo">Gancho<input className="entrada" value={c.gancho} onChange={(e) => cambiar({ gancho: e.target.value })} /></label>
                <label className="campo">Reflexión<textarea className="entrada" rows={3} value={c.reflexion} onChange={(e) => cambiar({ reflexion: e.target.value })} /></label>
              </>
            )}
            {cat === "versiculo" && (
              <>
                {!c.versiculo.texto.trim() && (
                  <div className="confirmar">
                    <p>Claude todavía no escribió este versículo. Puedes escribirlo a mano o pedírselo otra vez.</p>
                    <button type="button" className="btn pequeno primario" disabled={pidiendo} onClick={() => void pedirOtraVez()}>
                      {pidiendo ? "Claude está escribiendo…" : "Pedir a Claude otra vez"}
                    </button>
                    {errorPedir && <p className="error" role="alert">{errorPedir}</p>}
                  </div>
                )}
                <label className="campo">Referencia<input className="entrada" value={c.versiculo.ref} placeholder="Juan 8:12"
                  onChange={(e) => cambiar({ versiculo: { ...c.versiculo, ref: e.target.value, confirmado: false } })} /></label>
                <label className="campo">Texto (Reina-Valera 1960)
                  <textarea className="entrada texto-versiculo" rows={6} value={c.versiculo.texto}
                    onChange={(e) => cambiar({ versiculo: { ...c.versiculo, texto: e.target.value, confirmado: false } })} />
                </label>
                {c.versiculo.confirmado ? (
                  <p className="ok-texto"><Check size={13} aria-hidden="true" />Texto confirmado</p>
                ) : (
                  <div className="confirmar">
                    <p>Revisa el texto RVR1960: lo escribió Claude y puede tener diferencias.</p>
                    <button type="button" className="btn pequeno primario" disabled={!c.versiculo.texto.trim() || !c.versiculo.ref.trim()}
                      onClick={() => cambiar({ versiculo: { ...c.versiculo, confirmado: true } })}>Confirmar texto</button>
                  </div>
                )}
              </>
            )}
            {cat === "fondo" && (
              <>
                <Segmentos etiqueta="Fondo" valor={c.fondo.tipo === "video" ? "imagen" : c.fondo.tipo}
                  opciones={[["escena", "Escena animada"], ["pintura", "Pintura clásica"], ["degradado", "Degradado"], ["imagen", "Foto o video"]]}
                  alCambiar={(tipo) => cambiar({ fondo: tipo === "escena" ? { tipo, escena: c.fondo.escena ?? "luz" } : tipo === "pintura" ? { tipo, pintura: c.fondo.pintura ?? "prodigo" } : tipo === "imagen" ? { ...c.fondo, tipo: c.fondo.archivo && /\.(mp4|mov|m4v|webm)$/i.test(c.fondo.archivo) ? "video" : "imagen" } : { tipo } })} />
                {c.fondo.tipo === "pintura" && (
                  <div className="campo">Pintura
                    <div className="galeria-pinturas" role="radiogroup" aria-label="Pintura">
                      {Object.entries(PINTURAS).map(([id, p]) => (
                        <button key={id} type="button" role="radio" aria-checked={c.fondo.pintura === id} className="pintura-op"
                          onClick={() => cambiar({ fondo: { tipo: "pintura", pintura: id } })}>
                          <b>{p.obra}</b><span>{p.autor}, {p.anio}</span>
                        </button>
                      ))}
                    </div>
                    <span className="ayuda">Obras de dominio público (Wikimedia Commons).</span>
                  </div>
                )}
                {c.fondo.tipo === "escena" && (
                  <label className="campo">Escena
                    <select className="entrada" value={c.fondo.escena ?? "luz"} onChange={(e) => cambiar({ fondo: { tipo: "escena", escena: e.target.value as Escena } })}>
                      {(Object.keys(ESCENAS) as Escena[]).map((k) => <option key={k} value={k}>{ESCENAS[k].nombre}</option>)}
                    </select>
                  </label>
                )}
                {(c.fondo.tipo === "imagen" || c.fondo.tipo === "video") && (
                  <div className="fila">
                    <button type="button" className="btn" onClick={() => void elegirFondo()}><ImagePlus size={15} aria-hidden="true" />Elegir foto o video</button>
                    {c.fondo.archivo && <span className="ayuda">{c.fondo.archivo.split(/[\\/]/).pop()}</span>}
                  </div>
                )}
              </>
            )}
            {cat === "audio" && (
              <>
                <Segmentos etiqueta="Música" valor={c.musica.modo} opciones={[["auto", "Automática"], ["pad", "Pad"], ["ninguna", "Sin música"]]}
                  alCambiar={(modo) => cambiar({ musica: { ...c.musica, modo } })} />
                {c.musica.modo !== "ninguna" && (
                  <label className="campo">Ánimo de la música
                    <select className="entrada" value={c.musica.animo} onChange={(e) => cambiar({ musica: { ...c.musica, animo: e.target.value as Animo } })}>
                      {ANIMOS.map((a) => <option key={a} value={a}>{NOMBRE_ANIMO[a]}</option>)}
                    </select>
                  </label>
                )}
                <div className="fila"><Interruptor activo={c.sonidos !== false} etiqueta="Efectos de sonido" alCambiar={(sonidos) => cambiar({ sonidos })} /> Efectos de sonido (whoosh suave entre tarjetas)</div>
              </>
            )}
            {cat === "publicar" && (
              <>
                <div className="campo">Formatos a exportar
                  <div className="fila">
                    {(["9:16", "4:5", "1:1"] as Formato[]).map((f) => (
                      <label key={f} className="opcion"><input type="checkbox" checked={c.formatos.includes(f)}
                        onChange={(e) => cambiar({ formatos: e.target.checked ? [...c.formatos, f] : c.formatos.filter((x) => x !== f) })} /> {f}</label>
                    ))}
                  </div>
                </div>
                <Publicar redes={c.redes} alCambiar={(redes) => cambiar({ redes })} />
              </>
            )}
          </PanelCategorias>

          <div className="ia-pie">
            {sinConfirmar && <p className="aviso-chico"><TriangleAlert size={13} aria-hidden="true" />Confirma el texto RVR1960 para poder exportar.</p>}
            {!barra && botonExportar}
            <ColaExportacion proyectoId={`ia:${c.id}`}
              tareas={tareas.filter((t) => t.proyectoId === `ia:${c.id}` && (t.creada >= abierto || t.estado === "pendiente" || t.estado === "corriendo"))}
              alCancelar={(id) => void window.reels!.cancelar(id)} alAbrirCarpeta={() => void window.reels!.abrirCarpetaExportados(`ia:${c.id}`)} />
          </div>
        </div>
      </div>
    </div>
  );
}
