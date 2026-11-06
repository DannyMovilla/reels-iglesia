import { useState } from "react";
import { BookOpen, Check, Contrast, Copy, FileText, Flag, Send, Sparkles, TrendingUp, TriangleAlert, Type } from "lucide-react";
import { ANIMOS, type Animo, type ClipSpec, type EstiloSub, type Formato } from "@shared/tipos";
import { ESTILOS_SUB, NOMBRE_ESTILO } from "@shared/reel/estilos-sub";
import type { Pista } from "@shared/reel/pistas";
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
}

const TONALIDADES = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si", "Mib", "Lab", "Sib"];

type Pestana = "clip" | "estilo" | "publicar";

function Interruptor({ activo, etiqueta, alCambiar }: { activo: boolean; etiqueta: string; alCambiar(v: boolean): void }) {
  return <button type="button" className="interruptor" role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => alCambiar(!activo)} />;
}

function Segmentos<T extends string>({ opciones, valor, etiqueta, alCambiar }: { opciones: [T, string][]; valor: T; etiqueta: string; alCambiar(v: T): void }) {
  return (
    <div className="seg" role="group" aria-label={etiqueta}>
      {opciones.map(([v, texto]) => <button key={v} type="button" aria-pressed={valor === v} onClick={() => alCambiar(v)}>{texto}</button>)}
    </div>
  );
}

const FORMATOS: [Formato, string, string][] = [["9:16", "Reels · TikTok", "12px 21px"], ["4:5", "Feed IG · FB", "15px 19px"], ["1:1", "Cuadrado", "17px 17px"]];

export function Inspector({ clip: c, avisos, alCambiar, alGuardarEstilo, alAplicarEstilo, pistas }: Props) {
  const [pestana, setPestana] = useState<Pestana>("clip");
  const cambiar = (parcial: Partial<ClipSpec>) => alCambiar({ ...c, ...parcial });
  const cambiarVersiculo = (i: number, parcial: Partial<ClipSpec["versiculos"][number]>) =>
    cambiar({ versiculos: c.versiculos.map((v, j) => (j === i ? { ...v, ...parcial } : v)) });
  const textoPublicar = [c.descripcion, c.versiculos.filter((v) => v.activo).map((v) => `${v.ref} (RVR1960)`).join(" · "), c.hashtags.join(" ")].filter(Boolean).join("\n\n");

  return (
    <div className="inspector">
      <div className="pestanas" role="tablist">
        {([["clip", "Clip", FileText], ["estilo", "Estilo", Type], ["publicar", "Publicar", Send]] as const).map(([id, texto, Icono]) => (
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
                  <Interruptor activo={v.activo} etiqueta={`Mostrar ${v.ref}`} alCambiar={(activo) => cambiarVersiculo(i, { activo })} /></div>
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
            </div>
            <div className="grupo"><h3>Ritmo</h3>
              <div className="fila"><Interruptor activo={c.cortes.pausas} etiqueta="Acortar pausas largas" alCambiar={(pausas) => cambiar({ cortes: { ...c.cortes, pausas } })} /> Acortar pausas largas</div>
              <div className="fila"><Interruptor activo={c.cortes.muletillas} etiqueta="Quitar muletillas" alCambiar={(muletillas) => cambiar({ cortes: { ...c.cortes, muletillas } })} /> Quitar muletillas («eh», «em»)</div>
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

        {pestana === "publicar" && (
          <>
            <label className="campo">Descripción
              <textarea className="entrada" rows={4} value={c.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} />
            </label>
            <label className="campo">Hashtags
              <input className="entrada" value={c.hashtags.join(" ")} onChange={(e) => cambiar({ hashtags: e.target.value.split(/\s+/).filter(Boolean) })} />
            </label>
            <button type="button" className="btn" onClick={() => void navigator.clipboard?.writeText(textoPublicar)}><Copy size={14} aria-hidden="true" />Copiar texto para publicar</button>
          </>
        )}
      </div>
    </div>
  );
}
