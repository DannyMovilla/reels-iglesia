import { useEffect, useState } from "react";
import { BookOpen, Copy, Crosshair, ImageDown, LoaderCircle, Quote, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { fiel, type FondoFrase, type Frase } from "@shared/frases";
import { PINTURAS } from "@shared/reel/pinturas";
import { formatoTiempo } from "@shared/validar";
import { limpiarError } from "./Entregas";

const FONDOS: [FondoFrase, string][] = [["marca", "Marca"], ["momento", "Foto del momento"], ["pintura", "Pintura"]];

/**
 * «Frases para publicar»: Claude elige hasta 7 frases que dijo el predicador (palabra por palabra) y se guardan como
 * imágenes de 1080×1350 en exportados/frases.
 */
export function FrasesPublicar({ proyectoId, alIrA, videoDisponible = true }: { proyectoId: string; alIrA?(t: number): void; videoDisponible?: boolean }) {
  const api = window.reels!;
  const [frases, setFrases] = useState<Frase[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pintando, setPintando] = useState(false);
  const [listo, setListo] = useState<{ texto: string; avisos: string[] } | null>(null);
  /** Con frases ya guardadas, sacar otras las reemplaza: se pide confirmación. */
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Las pruebas de otras entregas no simulan leerFrases.
    void api.leerFrases?.(proyectoId).then((f) => { if (vivo && Array.isArray(f)) setFrases(f); }).catch(() => {});
    return () => { vivo = false; };
  }, [api, proyectoId]);

  const guardar = (nuevas: Frase[]) => {
    setFrases(nuevas);
    void api.guardarFrases(proyectoId, nuevas).catch((e) => setError(limpiarError(e)));
  };
  const cambiar = (i: number, parcial: Partial<Frase>, persistir = true) => {
    const nuevas = frases.map((f, j) => (j === i ? { ...f, ...parcial } : f));
    if (persistir) guardar(nuevas);
    else setFrases(nuevas);
  };

  const sacar = async () => {
    setConfirmar(false);
    setBuscando(true);
    setError(null);
    setAviso(null);
    setListo(null);
    try {
      const r = await api.sacarFrases(proyectoId);
      setFrases(r.frases);
      setAviso(r.aviso ?? null);
    } catch (e) {
      setError(limpiarError(e));
    } finally {
      setBuscando(false);
    }
  };

  const pintar = async () => {
    setPintando(true);
    setError(null);
    setListo(null);
    try {
      const r = await api.guardarImagenesFrases(proyectoId);
      const n = r.archivos.filter((a) => a.endsWith(".png")).length;
      setListo({ texto: `Listo: ${n} ${n === 1 ? "imagen" : "imágenes"} en exportados/frases`, avisos: r.avisos });
    } catch (e) {
      setError(limpiarError(e));
    } finally {
      setPintando(false);
    }
  };

  return (
    <section className="entrega">
      <h3><Quote size={16} aria-hidden="true" />Frases para publicar</h3>
      <p className="ayuda">Claude elige hasta 7 frases que dijo el predicador, palabra por palabra, para publicar como imagen (1080×1350).</p>
      <div className="fila">
        <button type="button" className="btn" disabled={buscando || confirmar} onClick={() => (frases.length ? setConfirmar(true) : void sacar())}>
          {buscando ? <><LoaderCircle size={15} className="girar" aria-hidden="true" />Buscando frases…</> : frases.length ? "Sacar otras frases" : "Sacar 7 frases"}
        </button>
        {buscando && <button type="button" className="btn pequeno fantasma" onClick={() => void api.cancelarFrases(proyectoId)}>Cancelar</button>}
      </div>
      {confirmar && (
        <div className="fila confirmar">
          <p className="aviso-chico"><TriangleAlert size={13} aria-hidden="true" />Esto reemplaza las frases de ahora y tus cambios.</p>
          <button type="button" className="btn pequeno primario" onClick={() => void sacar()}>Sí, reemplazar</button>
          <button type="button" className="btn pequeno fantasma" onClick={() => setConfirmar(false)}>No</button>
        </div>
      )}
      {aviso && <p className="ayuda" role="status">{aviso}</p>}
      {error && (
        <div className="fila">
          <p className="error" role="alert">{error}</p>
          {!buscando && <button type="button" className="btn pequeno" onClick={() => void sacar()}><RotateCcw size={13} aria-hidden="true" />Reintentar</button>}
        </div>
      )}
      {frases.length > 0 && (
        <ol className="frases" aria-label="Frases">
          {frases.map((f, i) => (
            <li key={`${f.en}-${i}`} className="frase-item">
              <div className="frase-cabeza"><span className="mono">{formatoTiempo(f.en)}</span></div>
              <textarea className="entrada" rows={3} aria-label={`Frase ${i + 1}`} value={f.texto}
                onChange={(e) => cambiar(i, { texto: e.target.value }, false)} onBlur={() => guardar(frases)} />
              {!fiel(f) && <p className="aviso-chico"><TriangleAlert size={13} aria-hidden="true" />Ya no es lo que dijo el predicador</p>}
              {f.versiculo && (
                <div className="frase-vers">
                  <BookOpen size={14} aria-hidden="true" /><b>{f.versiculo.ref}</b><span className="mono">RVR1960</span>
                  <p>{f.versiculo.texto}</p>
                  {f.versiculo.confirmado
                    ? <span className="ok-texto">Confirmado: sale en la imagen</span>
                    : <button type="button" className="btn pequeno" aria-label={`Confirmar ${f.versiculo.ref}`} onClick={() => cambiar(i, { versiculo: { ...f.versiculo!, confirmado: true } })}>Confirmar texto</button>}
                </div>
              )}
              <div className="seg" role="group" aria-label={`Fondo de la frase ${i + 1}`}>
                {FONDOS.map(([v, texto]) => (
                  <button key={v} type="button" aria-pressed={f.fondo === v} disabled={v === "momento" && !videoDisponible}
                    title={v === "momento" && !videoDisponible ? "No se encuentra el video original" : undefined}
                    onClick={() => cambiar(i, { fondo: v, ...(v === "pintura" && !f.pintura ? { pintura: Object.keys(PINTURAS)[0] } : {}) })}>{texto}</button>
                ))}
              </div>
              {f.fondo === "pintura" && (
                <select className="entrada" aria-label={`Pintura de la frase ${i + 1}`} value={f.pintura ?? Object.keys(PINTURAS)[0]} onChange={(e) => cambiar(i, { pintura: e.target.value })}>
                  {Object.entries(PINTURAS).map(([id, p]) => <option key={id} value={id}>{p.obra} · {p.autor}</option>)}
                </select>
              )}
              <div className="fila">
                <button type="button" className="btn pequeno fantasma" onClick={() => void navigator.clipboard?.writeText(f.texto)}><Copy size={13} aria-hidden="true" />Copiar</button>
                {alIrA && <button type="button" className="btn pequeno fantasma" onClick={() => alIrA(f.en)}><Crosshair size={13} aria-hidden="true" />Ir al momento</button>}
                <button type="button" className="btn pequeno fantasma" onClick={() => guardar(frases.filter((_, j) => j !== i))}><Trash2 size={13} aria-hidden="true" />Quitar</button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {frases.length > 0 && (
        <div className="fila">
          <button type="button" className="btn primario" disabled={pintando} onClick={() => void pintar()}>
            {pintando ? <LoaderCircle size={15} className="girar" aria-hidden="true" /> : <ImageDown size={15} aria-hidden="true" />}Guardar imágenes
          </button>
        </div>
      )}
      {listo && <p className="ayuda listo">{listo.texto}</p>}
      {listo?.avisos.map((a) => <p key={a} className="aviso-chico"><TriangleAlert size={13} aria-hidden="true" />{a}</p>)}
    </section>
  );
}
