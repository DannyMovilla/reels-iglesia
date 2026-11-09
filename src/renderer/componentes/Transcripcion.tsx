import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { nucleo, type Correccion } from "@shared/correcciones";
import type { Transcripcion as T } from "@shared/tipos";
import { tiempoConHoras } from "@shared/validar";

interface Props {
  transcripcion: T;
  /** El clip elegido: sus palabras van marcadas. */
  clip?: { inicio: number; fin: number };
  /** Segundo del video original que está sonando (para resaltar la palabra). */
  tiempoVideo?: number;
  /** Clic en una palabra: ir a ese segundo del video original. */
  alBuscar(t: number): void;
  alCorregir(c: Correccion): void;
  /** Rango elegido con Mayús + clic (o arrastrando), o null. */
  alSeleccionar(r: { inicio: number; fin: number } | null): void;
}

interface P { s: number; e: number; t: string; i: number }

/** Transcripción completa de la prédica: buscar, ir a un momento, corregir palabras y elegir un rango. */
export function Transcripcion({ transcripcion, clip, tiempoVideo, alBuscar, alCorregir, alSeleccionar }: Props) {
  const segmentos = useMemo(() => {
    let i = 0;
    return transcripcion.segmentos.map((s) => ({ s: s.s, palabras: s.w.map(([ws, we, wt]): P => ({ s: ws, e: we, t: wt.trim(), i: i++ })) }));
  }, [transcripcion]);
  const todas = useMemo(() => segmentos.flatMap((s) => s.palabras), [segmentos]);

  const [busqueda, setBusqueda] = useState("");
  const [actual, setActual] = useState(0);
  const coincidencias = useMemo(() => {
    const q = busqueda.split(/\s+/).map(nucleo).filter(Boolean);
    if (!q.length) return [] as number[];
    const r: number[] = [];
    for (let i = 0; i + q.length <= todas.length; i++) {
      if (q.every((x, j) => (j === q.length - 1 ? nucleo(todas[i + j].t).startsWith(x) : nucleo(todas[i + j].t) === x) || (q.length === 1 && nucleo(todas[i].t).includes(x)))) r.push(i);
    }
    return r;
  }, [busqueda, todas]);
  const largoBusqueda = busqueda.split(/\s+/).filter((x) => nucleo(x)).length;
  useEffect(() => setActual(0), [busqueda]);

  const [ancla, setAncla] = useState<number | null>(null);
  const [rango, setRango] = useState<[number, number] | null>(null);
  const arrastrando = useRef(false);
  const movido = useRef(false);
  const elegir = (a: number, b: number) => {
    const [x, y] = a <= b ? [a, b] : [b, a];
    setRango([x, y]);
    alSeleccionar({ inicio: todas[x].s, fin: todas[y].e });
  };

  const [corrigiendo, setCorrigiendo] = useState<{ p: P; texto: string } | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const i = coincidencias[actual];
    if (i === undefined) return;
    contenedor.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [actual, coincidencias]);

  const esCoincidencia = (i: number) => coincidencias.some((c) => i >= c && i < c + largoBusqueda);
  const esActual = (i: number) => coincidencias[actual] !== undefined && i >= coincidencias[actual] && i < coincidencias[actual] + largoBusqueda;

  const guardar = (todasLasApariciones: boolean) => {
    if (!corrigiendo) return;
    const a = corrigiendo.texto.trim();
    if (a) alCorregir(todasLasApariciones ? { de: corrigiendo.p.t, a } : { de: corrigiendo.p.t, a, en: corrigiendo.p.s });
    setCorrigiendo(null);
  };

  return (
    <div className="transcripcion">
      <div className="transcripcion-barra">
        <label className="buscador">
          <Search size={14} aria-hidden="true" />
          <input aria-label="Buscar en la transcripción" placeholder="Buscar en la prédica…" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && coincidencias.length) setActual((a) => (a + (e.shiftKey ? -1 : 1) + coincidencias.length) % coincidencias.length); }} />
        </label>
        {busqueda.trim() && <span className="mono contador">{coincidencias.length ? `${actual + 1} de ${coincidencias.length}` : "Sin resultados"}</span>}
        <button type="button" className="btn icono pequeno" aria-label="Coincidencia anterior" disabled={!coincidencias.length}
          onClick={() => setActual((a) => (a - 1 + coincidencias.length) % coincidencias.length)}><ChevronUp size={14} aria-hidden="true" /></button>
        <button type="button" className="btn icono pequeno" aria-label="Siguiente coincidencia" disabled={!coincidencias.length}
          onClick={() => setActual((a) => (a + 1) % coincidencias.length)}><ChevronDown size={14} aria-hidden="true" /></button>
      </div>
      <p className="ayuda">Clic: ir a ese momento. Doble clic: corregir la palabra. Mayús + clic o arrastrar: elegir un tramo.</p>

      {corrigiendo && (
        <div className="corregir" role="dialog" aria-label={`Corregir «${corrigiendo.p.t}»`}>
          <label className="campo">Palabra corregida
            <input className="entrada" autoFocus value={corrigiendo.texto} onChange={(e) => setCorrigiendo({ ...corrigiendo, texto: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Escape") setCorrigiendo(null); }} />
          </label>
          <div className="fila">
            <button type="button" className="btn pequeno" onClick={() => guardar(false)}>Solo aquí</button>
            <button type="button" className="btn pequeno primario" onClick={() => guardar(true)}>En toda la prédica</button>
            <button type="button" className="btn pequeno fantasma" onClick={() => setCorrigiendo(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="transcripcion-texto" ref={contenedor} onMouseUp={() => { arrastrando.current = false; }} onMouseLeave={() => { arrastrando.current = false; }}>
        {segmentos.map((seg) => (
          <p key={seg.s}>
            <span className="mono marca-tiempo">{tiempoConHoras(seg.s)}</span>
            {seg.palabras.map((p) => {
              const clases = [
                "palabra",
                clip && p.s >= clip.inicio && p.e <= clip.fin ? "en-clip" : "",
                rango && p.i >= rango[0] && p.i <= rango[1] ? "elegida" : "",
                esCoincidencia(p.i) ? "coincide" : "",
                esActual(p.i) ? "actual" : "",
                tiempoVideo !== undefined && tiempoVideo >= p.s && tiempoVideo < p.e ? "sonando" : "",
              ].filter(Boolean).join(" ");
              return (
                <button key={p.i} type="button" data-i={p.i} className={clases}
                  onMouseDown={(e) => { if (!e.shiftKey && e.button === 0) { arrastrando.current = true; movido.current = false; setAncla(p.i); } }}
                  onMouseEnter={() => { if (arrastrando.current && ancla !== null && ancla !== p.i) { movido.current = true; elegir(ancla, p.i); } }}
                  onClick={(e) => {
                    arrastrando.current = false;
                    if (e.shiftKey && ancla !== null) { elegir(ancla, p.i); return; }
                    if (movido.current) { movido.current = false; return; }
                    setAncla(p.i);
                    setRango(null);
                    alSeleccionar(null);
                    alBuscar(p.s);
                  }}
                  onDoubleClick={() => setCorrigiendo({ p, texto: p.t })}>
                  {p.t}
                </button>
              );
            })}
          </p>
        ))}
      </div>
    </div>
  );
}
