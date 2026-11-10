import { CopiarEstilo } from "./CopiarEstilo";
import { FUENTES, FUENTES_POR_DEFECTO, type IdFuente } from "@shared/reel/fuentes";
import { NOMBRE_LOOK, type Look } from "@shared/reel/color";
import { useState } from "react";
import { BookOpen, Check, Contrast, Copy, FileText, Flag, LoaderCircle, Send, Sparkles, TrendingUp, TriangleAlert, Type } from "lucide-react";
import { ANIMOS, type Animo, type ClipSpec, type EstiloSub, type Formato, type Redes } from "@shared/tipos";
import { ESTILOS_SUB, NOMBRE_ESTILO } from "@shared/reel/estilos-sub";
import { LIMITES_REDES, NOMBRE_RED, textoParaPublicar } from "@shared/redes";
import type { Pista } from "@shared/reel/pistas";
import { formatoTiempo } from "@shared/validar";
import { detectarRepeticiones } from "@shared/reel/cortes-voz";
import type { Palabra } from "@shared/reel/tiempo";
import { ChatClip, type EntradaChat } from "./ChatClip";
import { NOMBRE_ANIMO } from "../pantallas/Musica";

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
  /** Pestaña «Claude»: pedir cambios en palabras (con su historial por clip). */
  chat?: { proyectoId: string; historial: EntradaChat[]; alHistorial(h: EntradaChat[]): void };
}

const TONALIDADES = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si", "Mib", "Lab", "Sib"];

type Pestana = "clip" | "estilo" | "publicar" | "claude";

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

const FORMATOS: [Formato, string, string][] = [["9:16", "Reels · TikTok", "12px 21px"], ["4:5", "Feed IG · FB", "15px 19px"], ["1:1", "Cuadrado", "17px 17px"]];

export function Inspector({ clip: c, avisos, alCambiar, alGuardarEstilo, alAplicarEstilo, pistas, palabras, chat, preparandoVoz, alMedirColor, fuenteIglesia }: Props) {
  const [pestana, setPestana] = useState<Pestana>("clip");
  const cambiar = (parcial: Partial<ClipSpec>) => alCambiar({ ...c, ...parcial });
  const cambiarVersiculo = (i: number, parcial: Partial<ClipSpec["versiculos"][number]>) =>
    cambiar({ versiculos: c.versiculos.map((v, j) => (j === i ? { ...v, ...parcial } : v)) });

  return (
    <div className="inspector">
      <div className="pestanas" role="tablist">
        {([["clip", "Clip", FileText], ["estilo", "Estilo", Type], ["publicar", "Publicar", Send], ...(chat ? [["claude", "Claude", Sparkles]] as const : [])] as const).map(([id, texto, Icono]) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)}><Icono size={14} aria-hidden="true" />{texto}</button>
        ))}
      </div>
      <div className="inspector-cuerpo">
        {avisos.length > 0 && (
          <div className="avisos" role="status">{avisos.map((a) => <p key={a}><TriangleAlert size={14} aria-hidden="true" />{a}</p>)}</div>
        )}

        {pestana === "clip" && (
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
            {c.razon && <div className="porque"><TrendingUp size={16} aria-hidden="true" /><div><b>{c.puntaje} · Por qué funciona.</b> {c.razon}</div></div>}

            {c.versiculos.map((v, i) => (
              <div key={v.ref + i} className="tarjeta">
                <div className="tarjeta-cabeza"><BookOpen size={16} aria-hidden="true" /><b>{v.ref}</b><span className="mono">RVR1960</span>
                  <Interruptor activo={v.activo} etiqueta={`Mostrar ${v.ref}`} alCambiar={(activo) => cambiarVersiculo(i, { activo, fuera: false })} /></div>
                {v.fuera && !v.activo && <p className="aviso-chico"><TriangleAlert size={13} aria-hidden="true" />Quedó fuera del corte: el predicador lo cita en una parte que ya no está en el clip.</p>}
                <label className="campo">
                  <span className="sr">Texto RVR1960 de {v.ref}</span>
                  <textarea className="entrada texto-versiculo" rows={3} value={v.texto} onChange={(e) => cambiarVersiculo(i, { texto: e.target.value })} />
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

            {c.apertura && (
              <div className="tarjeta">
                <div className="tarjeta-cabeza"><Contrast size={16} aria-hidden="true" /><b>Apertura en blanco y negro</b>
                  <Interruptor activo={c.apertura.activa} etiqueta="Apertura en blanco y negro" alCambiar={(activa) => cambiar({ apertura: { ...c.apertura!, activa } })} /></div>
                <p>«{c.apertura.frase}» · {(c.apertura.fin - c.apertura.inicio).toFixed(1)} s</p>
              </div>
            )}
            <div className="tarjeta">
              <div className="tarjeta-cabeza"><Flag size={16} aria-hidden="true" /><b>Cierre con invitación</b>
                <Interruptor activo={c.cierre} etiqueta="Cierre con invitación" alCambiar={(cierre) => cambiar({ cierre })} /></div>
            </div>
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
          </>
        )}

        {pestana === "estilo" && (
          <>
            <div className="grupo"><h3>Subtítulos</h3>
              <div className="fila"><Interruptor activo={c.subtitulos.activos} etiqueta="Mostrar subtítulos" alCambiar={(activos) => cambiar({ subtitulos: { ...c.subtitulos, activos } })} /> Mostrar subtítulos</div>
              <Segmentos etiqueta="Estilo de subtítulos" valor={c.subtitulos.estilo} opciones={ESTILOS_SUB.map((e) => [e, NOMBRE_ESTILO[e]] as [EstiloSub, string])}
                alCambiar={(estilo) => cambiar({ subtitulos: { ...c.subtitulos, estilo } })} />
              <Segmentos etiqueta="Tamaño de subtítulos" valor={c.subtitulos.tamano} opciones={[["s", "Chico"], ["m", "Medio"], ["l", "Grande"]]}
                alCambiar={(tamano) => cambiar({ subtitulos: { ...c.subtitulos, tamano } })} />
              <label className="campo">Altura (9:16)
                <input type="range" min={0.55} max={0.86} step={0.01} value={c.subtitulos.altura} onChange={(e) => cambiar({ subtitulos: { ...c.subtitulos, altura: Number(e.target.value) } })} />
              </label>
            </div>
            <div className="grupo"><h3>Efectos</h3>
              <Segmentos etiqueta="Transición" valor={c.efectos.transicion} opciones={[["destello", "Destello"], ["luz", "Luz"], ["ninguna", "Ninguna"]]}
                alCambiar={(transicion) => cambiar({ efectos: { ...c.efectos, transicion } })} />
              <div className="fila"><Interruptor activo={c.efectos.grano} etiqueta="Grano de película" alCambiar={(grano) => cambiar({ efectos: { ...c.efectos, grano } })} /> Grano de película</div>
              <div className="fila"><Interruptor activo={c.efectos.rotulo} etiqueta="Nombre del predicador" alCambiar={(rotulo) => cambiar({ efectos: { ...c.efectos, rotulo } })} /> Nombre del predicador al inicio</div>
              <div className="fila"><Interruptor activo={c.efectos.sonidos !== false} etiqueta="Efectos de sonido" alCambiar={(sonidos) => cambiar({ efectos: { ...c.efectos, sonidos } })} /> Efectos de sonido (whoosh y pop)</div>
            </div>
            <div className="grupo"><h3>Ritmo</h3>
              <div className="fila"><Interruptor activo={c.cortes.pausas} etiqueta="Acortar pausas largas" alCambiar={(pausas) => cambiar({ cortes: { ...c.cortes, pausas } })} /> Acortar pausas largas</div>
              <Segmentos etiqueta="Intensidad de los cortes" valor={c.cortes.intensidad ?? "normal"} deshabilitado={!c.cortes.pausas}
                opciones={[["suave", "Suave"], ["normal", "Normal"], ["fuerte", "Fuerte"]]} alCambiar={(intensidad) => cambiar({ cortes: { ...c.cortes, intensidad } })} />
              <div className="fila"><Interruptor activo={c.cortes.muletillas} etiqueta="Quitar muletillas" alCambiar={(muletillas) => cambiar({ cortes: { ...c.cortes, muletillas } })} /> Quitar muletillas («eh», «em»)</div>
              {palabras && <Repeticiones clip={c} palabras={palabras} alCambiar={(quitados) => cambiar({ cortes: { ...c.cortes, quitados } })} />}
            </div>
            <CopiarEstilo clip={c} alAplicar={alCambiar} alGuardarEstilo={alGuardarEstilo ? (n) => { alCambiar(n); alGuardarEstilo(n); } : undefined} />
            <div className="grupo"><h3>Fuentes</h3>
              {(["titulos", "subtitulos"] as const).map((k) => (
                <label key={k} className="campo">{k === "titulos" ? "Fuente de títulos" : "Fuente de subtítulos"}
                  <select className="entrada" aria-label={k === "titulos" ? "Fuente de títulos" : "Fuente de subtítulos"}
                    value={(c.fuentes ?? FUENTES_POR_DEFECTO)[k]}
                    onChange={(e) => cambiar({ fuentes: { ...(c.fuentes ?? FUENTES_POR_DEFECTO), [k]: e.target.value as IdFuente } })}>
                    {(Object.keys(FUENTES) as IdFuente[]).filter((id) => id !== "iglesia" || fuenteIglesia).map((id) => <option key={id} value={id}>{FUENTES[id].nombre}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <ColorGrupo clip={c} alCambiar={(color) => cambiar({ color })} alMedir={alMedirColor} />
            <div className="grupo"><h3>Voz</h3>
              <Segmentos etiqueta="Nivel de voz" valor={c.voz ?? "limpia"} opciones={[["ligera", "Ligera"], ["limpia", "Limpia"], ["podcast", "Podcast"]]}
                alCambiar={(voz) => cambiar({ voz })} />
              <p className="ayuda">{{ ligera: "Para un buen micrófono: solo quita graves y empareja el volumen.", limpia: "Quita ruido, eco y graves (recomendada).", podcast: "Limpia, con más presencia y compresión suave, como un podcast." }[c.voz ?? "limpia"]}</p>
              {preparandoVoz && <p className="ayuda" role="status"><LoaderCircle size={13} className="girar" aria-hidden="true" /> Preparando la voz… (una vez por prédica)</p>}
            </div>
            <div className="grupo"><h3>Música</h3>
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
            </div>
            <div className="grupo"><h3>Encuadre</h3>
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
            </div>
            {(alGuardarEstilo || alAplicarEstilo) && (
              <div className="grupo"><h3>Estilo de la iglesia</h3>
                <p className="ayuda">Guarda cómo se ve este clip para que los próximos salgan igual.</p>
                <div className="fila-botones">
                  {alGuardarEstilo && <button type="button" className="btn pequeno" onClick={() => alGuardarEstilo(c)}>Guardar como estilo de la iglesia</button>}
                  {alAplicarEstilo && <button type="button" className="btn pequeno fantasma" onClick={() => alAplicarEstilo()}>Aplicar a todos los clips</button>}
                </div>
              </div>
            )}
          </>
        )}

        {pestana === "claude" && chat && <ChatClip proyectoId={chat.proyectoId} clip={c} historial={chat.historial} alHistorial={chat.alHistorial} alAplicar={alCambiar} />}
        {pestana === "publicar" && <Publicar redes={c.redes} alCambiar={(redes) => cambiar({ redes })} />}
      </div>
    </div>
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
function ColorGrupo({ clip: c, alCambiar, alMedir }: { clip: ClipSpec; alCambiar(color: ClipSpec["color"]): void; alMedir?(): Promise<[number, number, number]> }) {
  const color = c.color ?? { look: "natural" as Look, intensidad: 0.7 };
  const [midiendo, setMidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const medir = async () => {
    if (!alMedir) return;
    setMidiendo(true);
    setError(null);
    try {
      alCambiar({ ...color, balance: await alMedir() });
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    } finally {
      setMidiendo(false);
    }
  };
  return (
    <div className="grupo"><h3>Color</h3>
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
    </div>
  );
}
