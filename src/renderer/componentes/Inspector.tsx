import { CopiarEstilo } from "./CopiarEstilo";
import { cssFuentesElegidas, FUENTES, FUENTES_POR_DEFECTO, type IdFuente } from "@shared/reel/fuentes";
import { NOMBRE_LOOK, type Look } from "@shared/reel/color";
import { useRef, useState } from "react";
import { PanelCategorias, Seccion, type CategoriaRiel } from "./PanelCategorias";
import {
  AudioLines, BookOpen, Check, Copy, Image, LoaderCircle, Palette, Scissors, Send, Sparkles, Subtitles, TrendingUp, TriangleAlert, Type,

} from "lucide-react";
import { ANIMOS, type Animo, type ClipSpec, type EstiloSub, type Formato, type Redes } from "@shared/tipos";
import { ESTILOS_SUB, NOMBRE_ESTILO } from "@shared/reel/estilos-sub";
import { LIMITES_REDES, NOMBRE_RED, textoParaPublicar } from "@shared/redes";
import type { Pista } from "@shared/reel/pistas";
import { formatoTiempo } from "@shared/validar";
import { detectarRepeticiones } from "@shared/reel/cortes-voz";
import type { Palabra } from "@shared/reel/tiempo";
import { ChatClip, type EntradaChat } from "./ChatClip";
import { Galeria, muestraGancho, muestraSub } from "./Galeria";
import { FAMILIAS_SUB } from "./familias";
import { ESTILOS_GANCHO, NOMBRE_GANCHO, type EstiloGancho } from "@shared/reel/gancho";
import { NOMBRE_ANIMO } from "../pantallas/Musica";

/** Categorías del panel de la derecha (una a la vez, elegidas en el riel del borde). */
export type Categoria = "gancho" | "subtitulos" | "versiculo" | "imagen" | "audio" | "ritmo" | "publicar" | "estilo" | "claude";

const CATEGORIAS: CategoriaRiel<Categoria>[] = [
  { id: "gancho", nombre: "Gancho", titulo: "Gancho", ayuda: "El título del clip y la frase grande de los primeros segundos.", Icono: Type },
  { id: "subtitulos", nombre: "Subtítulos", titulo: "Subtítulos", ayuda: "Cómo se ven las palabras mientras habla el predicador.", Icono: Subtitles },
  { id: "versiculo", nombre: "Versículo", titulo: "Versículo", ayuda: "La cita bíblica que aparece en el clip (RVR1960).", Icono: BookOpen },
  { id: "imagen", nombre: "Imagen", titulo: "Imagen", ayuda: "Color, encuadre, efectos y el principio y final del clip.", Icono: Image },
  { id: "audio", nombre: "Audio", titulo: "Audio", ayuda: "La voz del predicador, la música de fondo y los efectos de sonido.", Icono: AudioLines },
  { id: "ritmo", nombre: "Ritmo", titulo: "Ritmo", ayuda: "Pausas, muletillas y frases repetidas que se quitan del clip.", Icono: Scissors },
  { id: "publicar", nombre: "Publicar", titulo: "Publicar", ayuda: "Los formatos a exportar y el texto para cada red.", Icono: Send, separado: true },
  { id: "estilo", nombre: "Mi estilo", titulo: "Estilo de la iglesia", ayuda: "Guarda cómo se ve este clip o copia el estilo de un reel que te guste.", Icono: Palette },
  { id: "claude", nombre: "Claude", titulo: "Pedirle a Claude", ayuda: "Cambia el clip escribiendo lo que quieres.", Icono: Sparkles },
];

interface Props {
  clip: ClipSpec;
  avisos: string[];
  alCambiar(c: ClipSpec): void;
  /** "Guardar como estilo de la iglesia" con este clip. */
  alGuardarEstilo?(c: ClipSpec): void;
  /** "Aplicar a todos los clips" el estilo de la iglesia. */
  alAplicarEstilo?(): void;
  /** Pistas propias de la iglesia (para "Mi pista"). */
  pistas?: Pista[];
  /** Palabras de la transcripción (para sugerir frases repetidas). */
  palabras?: Palabra[];
  /** La marca tiene fuente propia (aparece «La de la iglesia»). */
  fuenteIglesia?: boolean;
  /** Mide el balance de blancos del video de este clip («Corregir tono amarillo»). */
  alMedirColor?(): Promise<[number, number, number]>;
  /** El nivel de voz elegido todavía se está preparando. */
  preparandoVoz?: boolean;
  /** Categoría «Claude»: pedir cambios en palabras (con su historial por clip). */
  chat?: { proyectoId: string; historial: EntradaChat[]; alHistorial(h: EntradaChat[]): void };
  /** Color de la marca (para las muestras de las galerías). */
  colorMarca?: string;
  /** URL del archivo de la fuente de la iglesia (para que las galerías la usen). */
  urlFuenteIglesia?: string;
  /** Categoría abierta, si la maneja el editor (la línea de tiempo también la cambia). */
  categoria?: Categoria;
  alCategoria?(c: Categoria): void;
}

const TONALIDADES = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si", "Mib", "Lab", "Sib"];

export function Interruptor({ activo, etiqueta, alCambiar }: { activo: boolean; etiqueta: string; alCambiar(v: boolean): void }) {
  return <button type="button" className="interruptor" role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => alCambiar(!activo)} />;
}

export function Segmentos<T extends string>({ opciones, valor, etiqueta, alCambiar, deshabilitado }: { opciones: [T, string][]; valor: T; etiqueta: string; alCambiar(v: T): void; deshabilitado?: boolean }) {
  return (
    <div className="seg" role="group" aria-label={etiqueta}>
      {opciones.map(([v, texto]) => <button key={v} type="button" disabled={deshabilitado} aria-pressed={valor === v} onClick={() => alCambiar(v)}>{texto}</button>)}
    </div>
  );
}

export { Seccion };

const FORMATOS: [Formato, string, string][] = [["9:16", "Reels · TikTok", "12px 21px"], ["4:5", "Feed IG · FB", "15px 19px"], ["1:1", "Cuadrado", "17px 17px"]];
const TAMANO: Record<string, string> = { s: "Chico", m: "Medio", l: "Grande" };
const MUSICA: Record<string, string> = { auto: "Automática", pista: "Mi pista", pad: "Pad", ninguna: "Sin música" };
const TRANSICION: Record<string, string> = { destello: "Destello", luz: "Luz", ninguna: "Sin transición" };
const VOZ: Record<string, string> = { ligera: "Ligera", limpia: "Limpia", podcast: "Podcast" };
const nombreFuente = (id: IdFuente) => (id === "iglesia" ? "La de la iglesia" : FUENTES[id].nombre);

export function Inspector({ clip: c, avisos, alCambiar, alGuardarEstilo, alAplicarEstilo, pistas, palabras, chat, preparandoVoz, alMedirColor, fuenteIglesia, colorMarca, urlFuenteIglesia, categoria, alCategoria }: Props) {
  // El clip de ahora (las mediciones que tardan se aplican sobre lo último que eligió la persona).
  const ultimo = useRef(c);
  ultimo.current = c;
  const [propia, setPropia] = useState<Categoria>("gancho");
  const faltaConfirmar = c.versiculos.some((v) => v.activo && !v.confirmado);
  const cats = CATEGORIAS.filter((k) => k.id !== "claude" || chat)
    .map((k) => (k.id === "versiculo" && faltaConfirmar ? { ...k, aviso: "Falta confirmar el texto" } : k));
  const pedida = categoria ?? propia;
  const cat = cats.find((k) => k.id === pedida) ?? cats[0];
  const elegir = (id: Categoria) => { setPropia(id); alCategoria?.(id); };
  const cambiar = (parcial: Partial<ClipSpec>) => alCambiar({ ...c, ...parcial });
  const cambiarVersiculo = (i: number, parcial: Partial<ClipSpec["versiculos"][number]>) =>
    cambiar({ versiculos: c.versiculos.map((v, j) => (j === i ? { ...v, ...parcial } : v)) });
  const fuentes = c.fuentes ?? FUENTES_POR_DEFECTO;
  const cssFuente = cssFuentesElegidas(c.fuentes, urlFuenteIglesia);

  return (
    <PanelCategorias etiqueta="Categorías de ajustes" categorias={cats} actual={cat.id} alElegir={elegir}
      cabeza={cat.id === "subtitulos" ? <Interruptor activo={c.subtitulos.activos} etiqueta="Mostrar subtítulos" alCambiar={(activos) => cambiar({ subtitulos: { ...c.subtitulos, activos } })} /> : undefined}>
          {avisos.length > 0 && (
            <div className="avisos" role="status">{avisos.map((a) => <p key={a}><TriangleAlert size={14} aria-hidden="true" />{a}</p>)}</div>
          )}

          {cat.id === "gancho" && (
            <>
              <label className="campo">Título del clip
                <input className="entrada" value={c.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} />
              </label>
              <div className="campo">
                <div className="campo-cabeza"><label htmlFor="gancho">Gancho en pantalla</label><span className="mono" aria-hidden="true">{c.gancho.length}/40</span></div>
                <input id="gancho" className="entrada" maxLength={60} value={c.gancho} onChange={(e) => cambiar({ gancho: e.target.value })} />
                {c.ganchosAlternativos.length > 0 && (
                  <div className="alternativas" aria-label="Otras opciones de Claude">
                    {c.ganchosAlternativos.map((g, i) => (
                      <button key={g + i} type="button" className="alt" onClick={() => cambiar({ gancho: g, ganchosAlternativos: c.ganchosAlternativos.map((x, j) => (j === i ? c.gancho : x)) })}>
                        <Sparkles size={12} aria-hidden="true" />{g}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="campo">
                <span>Estilo del gancho</span>
                <Galeria etiqueta="Estilo del gancho" color={colorMarca} cssFuente={cssFuente} valor={c.estiloGancho ?? "tarjeta"}
                  opciones={ESTILOS_GANCHO.map((e) => [e, NOMBRE_GANCHO[e]] as [EstiloGancho, string])}
                  muestra={(e) => muestraGancho(e, colorMarca ?? "#f5c542")} alCambiar={(estiloGancho) => cambiar({ estiloGancho })} />
              </div>
              {c.razon && <div className="porque"><TrendingUp size={16} aria-hidden="true" /><div><b>{c.puntaje} · Por qué funciona.</b> {c.razon}</div></div>}
            </>
          )}

          {cat.id === "subtitulos" && (
            <>
              <Galeria etiqueta="Estilo de subtítulos" color={colorMarca} cssFuente={cssFuente} valor={c.subtitulos.estilo} familias={FAMILIAS_SUB} recorte
                opciones={ESTILOS_SUB.map((e) => [e, NOMBRE_ESTILO[e]] as [EstiloSub, string])}
                muestra={(e) => muestraSub(e, colorMarca ?? "#f5c542")} alCambiar={(estilo) => cambiar({ subtitulos: { ...c.subtitulos, estilo } })} />
              <Seccion titulo="Tamaño" resumen={TAMANO[c.subtitulos.tamano]}>
                <Segmentos etiqueta="Tamaño de subtítulos" valor={c.subtitulos.tamano} opciones={[["s", "Chico"], ["m", "Medio"], ["l", "Grande"]]}
                  alCambiar={(tamano) => cambiar({ subtitulos: { ...c.subtitulos, tamano } })} />
              </Seccion>
              <Seccion titulo="Altura en pantalla" abierta={false} resumen={`${Math.round(c.subtitulos.altura * 100)} %`}>
                <label className="campo">Altura (9:16)
                  <input type="range" min={0.55} max={0.86} step={0.01} value={c.subtitulos.altura} onChange={(e) => cambiar({ subtitulos: { ...c.subtitulos, altura: Number(e.target.value) } })} />
                </label>
              </Seccion>
              <Seccion titulo="Fuentes" abierta={false} resumen={`${nombreFuente(fuentes.titulos)} · ${nombreFuente(fuentes.subtitulos)}`}>
                {(["titulos", "subtitulos"] as const).map((k) => (
                  <label key={k} className="campo">{k === "titulos" ? "Fuente de títulos" : "Fuente de subtítulos"}
                    <select className="entrada" aria-label={k === "titulos" ? "Fuente de títulos" : "Fuente de subtítulos"}
                      value={fuentes[k]}
                      onChange={(e) => cambiar({ fuentes: { ...fuentes, [k]: e.target.value as IdFuente } })}>
                      {(Object.keys(FUENTES) as IdFuente[]).filter((id) => id !== "iglesia" || fuenteIglesia || fuentes[k] === "iglesia").map((id) => (
                        <option key={id} value={id}>{id === "iglesia" && !fuenteIglesia ? `La de la iglesia (falta el archivo: se usa ${FUENTES[FUENTES_POR_DEFECTO[k]].nombre})` : FUENTES[id].nombre}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </Seccion>
            </>
          )}

          {cat.id === "versiculo" && (
            <>
              {c.versiculos.length === 0 && <p className="vacio-categoria">Este clip no cita ningún versículo. Si el predicador cita uno, Claude lo agrega al analizar.</p>}
              {c.versiculos.map((v, i) => (
                <div key={v.ref + i} className="tarjeta">
                  <div className="tarjeta-cabeza"><BookOpen size={16} aria-hidden="true" /><b>{v.ref}</b><span className="mono">RVR1960</span>
                    <Interruptor activo={v.activo} etiqueta={`Mostrar ${v.ref}`} alCambiar={(activo) => cambiarVersiculo(i, { activo, fuera: false })} /></div>
                  {v.fuera && !v.activo && <p className="aviso-chico"><TriangleAlert size={13} aria-hidden="true" />Quedó fuera del corte: el predicador lo cita en una parte que ya no está en el clip.</p>}
                  <label className="campo">
                    <span className="sr">Texto RVR1960 de {v.ref}</span>
                    <textarea className="entrada texto-versiculo" rows={4} value={v.texto} onChange={(e) => cambiarVersiculo(i, { texto: e.target.value })} />
                  </label>
                  {v.confirmado ? (
                    <p className="ok-texto"><Check size={13} aria-hidden="true" />Texto confirmado</p>
                  ) : (
                    <div className="confirmar">
                      <p>Revisa el texto RVR1960 antes de exportar: lo escribió Claude y puede tener diferencias.</p>
                      <button type="button" className="btn pequeno primario" disabled={!v.texto.trim()} onClick={() => cambiarVersiculo(i, { confirmado: true })}>Confirmar texto</button>
                    </div>
                  )}
                  <p className="regla">Los subtítulos se ocultan mientras aparece la cita.</p>
                </div>
              ))}
            </>
          )}

          {cat.id === "imagen" && (
            <>
              <ColorGrupo clip={c} alCambiar={(col) => cambiar({ color: col })} alMedir={alMedirColor}
                alBalance={(id, balance) => { const ahora = ultimo.current; if (ahora.id === id) alCambiar({ ...ahora, color: { ...(ahora.color ?? { look: "natural", intensidad: 0.7 }), balance } }); }} />
              <Seccion titulo="Encuadre" resumen={c.encuadre.modo === "auto" ? "Sigue la cara" : "Fijo"}>
                <Segmentos etiqueta="Seguimiento" valor={c.encuadre.modo} opciones={[["auto", "Seguir la cara"], ["fijo", "Fijo"]]}
                  alCambiar={(modo) => cambiar({ encuadre: { ...c.encuadre, modo } })} />
                {c.encuadre.modo === "fijo" && (
                  <label className="campo">Posición
                    <input type="range" min={0} max={1} step={0.01} value={c.encuadre.x} onChange={(e) => cambiar({ encuadre: { ...c.encuadre, x: Number(e.target.value) } })} />
                  </label>
                )}
                <label className="campo">Zoom
                  <input type="range" min={1} max={2} step={0.05} value={c.encuadre.zoom} onChange={(e) => cambiar({ encuadre: { ...c.encuadre, zoom: Number(e.target.value) } })} />
                </label>
              </Seccion>
              <Seccion titulo="Efectos" resumen={[TRANSICION[c.efectos.transicion], c.efectos.grano && "grano"].filter(Boolean).join(" · ")}>
                <Segmentos etiqueta="Transición" valor={c.efectos.transicion} opciones={[["destello", "Destello"], ["luz", "Luz"], ["ninguna", "Ninguna"]]}
                  alCambiar={(transicion) => cambiar({ efectos: { ...c.efectos, transicion } })} />
                <div className="fila"><Interruptor activo={c.efectos.grano} etiqueta="Grano de película" alCambiar={(grano) => cambiar({ efectos: { ...c.efectos, grano } })} /> Grano de película</div>
                <div className="fila"><Interruptor activo={c.efectos.rotulo} etiqueta="Nombre del predicador" alCambiar={(rotulo) => cambiar({ efectos: { ...c.efectos, rotulo } })} /> Nombre del predicador al inicio</div>
              </Seccion>
              <Seccion titulo="Principio y final" resumen={[c.apertura?.activa && "B/N", c.cierre && "invitación"].filter(Boolean).join(" · ") || "Sin extras"}>
                {c.apertura && (
                  <div className="fila"><Interruptor activo={c.apertura.activa} etiqueta="Apertura en blanco y negro" alCambiar={(activa) => cambiar({ apertura: { ...c.apertura!, activa } })} />
                    <span>Apertura en blanco y negro <span className="tenue">«{c.apertura.frase}» · {(c.apertura.fin - c.apertura.inicio).toFixed(1)} s</span></span></div>
                )}
                <div className="fila"><Interruptor activo={c.cierre} etiqueta="Cierre con invitación" alCambiar={(cierre) => cambiar({ cierre })} /> Cierre con invitación</div>
              </Seccion>
            </>
          )}

          {cat.id === "audio" && (
            <>
              <Seccion titulo="Voz del predicador" resumen={VOZ[c.voz ?? "limpia"]}>
                <Segmentos etiqueta="Nivel de voz" valor={c.voz ?? "limpia"} opciones={[["ligera", "Ligera"], ["limpia", "Limpia"], ["podcast", "Podcast"]]}
                  alCambiar={(voz) => cambiar({ voz })} />
                <p className="ayuda">{{ ligera: "Para un buen micrófono: solo quita graves y empareja el volumen.", limpia: "Quita ruido, eco y graves (recomendada).", podcast: "Limpia, con más presencia y compresión suave, como un podcast." }[c.voz ?? "limpia"]}</p>
                {preparandoVoz && <p className="ayuda" role="status"><LoaderCircle size={13} className="girar" aria-hidden="true" /> Preparando la voz… (una vez por prédica)</p>}
              </Seccion>
              <Seccion titulo="Música de fondo" resumen={MUSICA[c.musica.modo]}>
                <Segmentos etiqueta="Música" valor={c.musica.modo} opciones={[["auto", "Automática"], ["pista", "Mi pista"], ["pad", "Pad"], ["ninguna", "Sin música"]]}
                  alCambiar={(modo) => cambiar({ musica: { ...c.musica, modo } })} />
                {c.musica.modo !== "ninguna" && (
                  <>
                    {c.musica.modo === "pista" ? (
                      <label className="campo">Pista
                        <select className="entrada" value={c.musica.pista ?? ""} onChange={(e) => cambiar({ musica: { ...c.musica, pista: e.target.value || null } })}>
                          <option value="">Elegir según el ánimo</option>
                          {(pistas ?? []).map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                        </select>
                      </label>
                    ) : (
                      <label className="campo">Ánimo de la música
                        <select className="entrada" value={c.musica.animo} onChange={(e) => cambiar({ musica: { ...c.musica, animo: e.target.value as Animo } })}>
                          {ANIMOS.map((a) => <option key={a} value={a}>{NOMBRE_ANIMO[a]}</option>)}
                        </select>
                      </label>
                    )}
                    {c.musica.modo !== "pista" && (
                      <label className="campo">Tonalidad
                        <select className="entrada" value={c.musica.tonalidad} onChange={(e) => cambiar({ musica: { ...c.musica, tonalidad: e.target.value } })}>
                          {TONALIDADES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                    )}
                    <label className="campo">Volumen bajo la voz
                      <input type="range" aria-label="Volumen de la música" min={0.04} max={0.3} step={0.01} value={c.musica.volumen}
                        onChange={(e) => cambiar({ musica: { ...c.musica, volumen: Number(e.target.value) } })} />
                    </label>
                  </>
                )}
              </Seccion>
              <Seccion titulo="Efectos de sonido" resumen={c.efectos.sonidos !== false ? "Whoosh y pop" : "Apagados"}>
                <div className="fila"><Interruptor activo={c.efectos.sonidos !== false} etiqueta="Efectos de sonido" alCambiar={(sonidos) => cambiar({ efectos: { ...c.efectos, sonidos } })} /> Efectos de sonido (whoosh y pop)</div>
              </Seccion>
            </>
          )}

          {cat.id === "ritmo" && (
            <>
              <div className="fila"><Interruptor activo={c.cortes.pausas} etiqueta="Acortar pausas largas" alCambiar={(pausas) => cambiar({ cortes: { ...c.cortes, pausas } })} /> Acortar pausas largas</div>
              <Segmentos etiqueta="Intensidad de los cortes" valor={c.cortes.intensidad ?? "normal"} deshabilitado={!c.cortes.pausas}
                opciones={[["suave", "Suave"], ["normal", "Normal"], ["fuerte", "Fuerte"]]} alCambiar={(intensidad) => cambiar({ cortes: { ...c.cortes, intensidad } })} />
              <div className="fila"><Interruptor activo={c.cortes.muletillas} etiqueta="Quitar muletillas" alCambiar={(muletillas) => cambiar({ cortes: { ...c.cortes, muletillas } })} /> Quitar muletillas («eh», «em»)</div>
              {palabras && <Repeticiones clip={c} palabras={palabras} alCambiar={(quitados) => cambiar({ cortes: { ...c.cortes, quitados } })} />}
            </>
          )}

          {cat.id === "publicar" && (
            <>
              <div className="campo">
                <span>Formatos a exportar</span>
                <div className="formatos" role="group" aria-label="Formatos">
                  {FORMATOS.map(([f, nota, caja]) => {
                    const on = c.formatos.includes(f);
                    return (
                      <button key={f} type="button" className="fmt" aria-pressed={on}
                        onClick={() => cambiar({ formatos: on ? c.formatos.filter((x) => x !== f) : [...c.formatos, f] })}>
                        <i style={{ width: caja.split(" ")[0], height: caja.split(" ")[1] }} />{f}<span>{nota}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Publicar redes={c.redes} alCambiar={(redes) => cambiar({ redes })} />
            </>
          )}

          {cat.id === "estilo" && (
            <>
              {(alGuardarEstilo || alAplicarEstilo) && (
                <Seccion titulo="Guardar este estilo">
                  <p className="ayuda">Guarda cómo se ve este clip para que los próximos salgan igual.</p>
                  <div className="fila-botones">
                    {alGuardarEstilo && <button type="button" className="btn pequeno" onClick={() => alGuardarEstilo(c)}>Guardar como estilo de la iglesia</button>}
                    {alAplicarEstilo && <button type="button" className="btn pequeno fantasma" onClick={() => alAplicarEstilo()}>Aplicar a todos los clips</button>}
                  </div>
                </Seccion>
              )}
              <CopiarEstilo clip={c} alAplicar={alCambiar} alGuardarEstilo={alGuardarEstilo ? (n) => { alCambiar(n); alGuardarEstilo(n); } : undefined} />
            </>
          )}

          {cat.id === "claude" && chat && <ChatClip proyectoId={chat.proyectoId} clip={c} historial={chat.historial} alHistorial={chat.alHistorial} alAplicar={alCambiar} />}
    </PanelCategorias>
  );
}

/** Contador "n / límite" que se pone en rojo al pasarse. */
function Contador({ n, max }: { n: number; max: number }) {
  return <span className={`contador${n > max ? " pasado" : ""}`}>{n} / {max}</span>;
}

/** Pestaña Publicar: el texto de cada red, con su límite y un botón para copiarlo. */
export function Publicar({ redes, alCambiar }: { redes: Redes; alCambiar(r: Redes): void }) {
  const [red, setRed] = useState<keyof Redes>("instagram");
  const [copiado, setCopiado] = useState(false);
  const nombre = NOMBRE_RED[red];
  const L = LIMITES_REDES;
  const cambiarRed = <K extends keyof Redes>(k: K, v: Partial<Redes[K]>) => alCambiar({ ...redes, [k]: { ...redes[k], ...v } });
  const actual = redes[red] as { texto: string; hashtags?: string[]; titulo?: string };
  const limiteTexto = L[red].texto;
  const copiar = async () => {
    await navigator.clipboard?.writeText(textoParaPublicar(redes, red));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };
  return (
    <>
      <Segmentos etiqueta="Red" valor={red} opciones={(Object.keys(NOMBRE_RED) as (keyof Redes)[]).map((k) => [k, NOMBRE_RED[k]] as [keyof Redes, string])}
        alCambiar={(r) => { setRed(r); setCopiado(false); }} />
      {red === "youtube" && (
        <div className="campo">
          <span className="campo-cabeza">Título <Contador n={redes.youtube.titulo.length} max={L.youtube.titulo} /></span>
          <input className="entrada" aria-label={`Título para ${nombre}`} aria-invalid={redes.youtube.titulo.length > L.youtube.titulo}
            value={redes.youtube.titulo} onChange={(e) => cambiarRed("youtube", { titulo: e.target.value })} />
        </div>
      )}
      <div className="campo">
        <span className="campo-cabeza">Texto <Contador n={actual.texto.length} max={limiteTexto} /></span>
        <textarea className="entrada" rows={6} aria-label={`Texto para ${nombre}`} aria-invalid={actual.texto.length > limiteTexto}
          value={actual.texto} onChange={(e) => cambiarRed(red, { texto: e.target.value } as Partial<Redes[typeof red]>)} />
      </div>
      {(red === "instagram" || red === "tiktok") && (
        <div className="campo">
          <span className="campo-cabeza">Hashtags {red === "instagram" && <Contador n={redes.instagram.hashtags.length} max={L.instagram.hashtags} />}</span>
          <input className="entrada" aria-label={`Hashtags para ${nombre}`} value={redes[red].hashtags.join(" ")}
            onChange={(e) => cambiarRed(red, { hashtags: e.target.value.split(/\s+/).filter(Boolean) })} />
        </div>
      )}
      <div className="fila">
        <button type="button" className="btn" onClick={() => void copiar()}><Copy size={14} aria-hidden="true" />Copiar para {nombre}</button>
        {copiado && <span className="ok-texto" role="status">Copiado</span>}
      </div>
    </>
  );
}

/** Frases repetidas que la app sugiere quitar (nada se quita hasta tocar "Quitar") y los tramos quitados. */
function Repeticiones({ clip: c, palabras, alCambiar }: { clip: ClipSpec; palabras: Palabra[]; alCambiar(q: { inicio: number; fin: number }[]): void }) {
  const sugerencias = detectarRepeticiones(palabras, c.inicio, c.fin);
  const quitados = c.cortes.quitados ?? [];
  const igual = (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) => a.inicio === b.inicio && a.fin === b.fin;
  return (
    <div className="repeticiones">
      <h4>Frases repetidas</h4>
      {sugerencias.length === 0 && <p className="ayuda">No encontré frases repetidas en este clip.</p>}
      {sugerencias.length > 0 && (
        <ul>
          {sugerencias.map((r) => {
            const q = quitados.some((x) => igual(x, r));
            return (
              <li key={`${r.inicio}-${r.fin}`} className={q ? "quitada" : ""}>
                <span>«{r.texto}»</span>
                <button type="button" className="btn pequeno" aria-label={`${q ? "Volver a poner" : "Quitar"} «${r.texto}»`}
                  onClick={() => alCambiar(q ? quitados.filter((x) => !igual(x, r)) : [...quitados, { inicio: r.inicio, fin: r.fin }])}>
                  {q ? "Volver a poner" : "Quitar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {quitados.length > 0 && (
        <>
          <div className="fila">
            <span>Tramos quitados a mano: {quitados.length}</span>
            <button type="button" className="btn pequeno fantasma" onClick={() => alCambiar([])}>Volver a poner todos</button>
          </div>
          <ul className="tramos-quitados">
            {quitados.map((q, i) => {
              const texto = `${formatoTiempo(q.inicio)}–${formatoTiempo(q.fin)}`;
              return (
                <li key={`${q.inicio}-${q.fin}-${i}`}>
                  <span className="mono">{texto}</span>
                  <button type="button" className="btn pequeno fantasma" aria-label={`Volver a poner el tramo ${texto}`}
                    onClick={() => alCambiar(quitados.filter((_, j) => j !== i))}>Volver a poner</button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/** Corrección de color del video: look, intensidad y balance de blancos medido del video. */
function ColorGrupo({ clip: c, alCambiar, alMedir, alBalance }: {
  clip: ClipSpec; alCambiar(color: ClipSpec["color"]): void; alMedir?(): Promise<[number, number, number]>;
  alBalance(id: string, balance: [number, number, number]): void;
}) {
  const color = c.color ?? { look: "natural" as Look, intensidad: 0.7 };
  const [midiendo, setMidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const medir = async () => {
    if (!alMedir) return;
    setMidiendo(true);
    setError(null);
    try {
      const id = c.id;
      alBalance(id, await alMedir());
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    } finally {
      setMidiendo(false);
    }
  };
  return (
    <Seccion titulo="Color" resumen={NOMBRE_LOOK[color.look] + (color.balance ? " · tono corregido" : "")}>
      <Segmentos etiqueta="Look de color" valor={color.look} opciones={(Object.keys(NOMBRE_LOOK) as Look[]).map((l) => [l, NOMBRE_LOOK[l]] as [Look, string])}
        alCambiar={(look) => alCambiar({ ...color, look })} />
      {color.look !== "natural" && (
        <label className="campo">
          <span className="campo-cabeza">Intensidad <span className="mono">{Math.round(color.intensidad * 100)} %</span></span>
          <input type="range" aria-label="Intensidad del color" min={0} max={100} step={5} value={Math.round(color.intensidad * 100)}
            onChange={(e) => alCambiar({ ...color, intensidad: Number(e.target.value) / 100 })} />
        </label>
      )}
      {alMedir && (
        <div className="fila">
          {color.balance
            ? <button type="button" className="btn pequeno fantasma" onClick={() => alCambiar({ look: color.look, intensidad: color.intensidad })}>Quitar corrección de tono</button>
            : <button type="button" className="btn pequeno" disabled={midiendo} onClick={() => void medir()}>
                {midiendo && <LoaderCircle size={13} className="girar" aria-hidden="true" />}Corregir tono amarillo
              </button>}
        </div>
      )}
      {color.balance && <p className="ayuda">Tono corregido con el color promedio del video.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </Seccion>
  );
}
