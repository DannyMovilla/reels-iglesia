import { useEffect, useState } from "react";
import { BookOpen, LoaderCircle, Plus, Sparkles } from "lucide-react";
import type { Creacion } from "@shared/tipos";
import { EditorVersiculo } from "../componentes/EditorVersiculo";

const limpiar = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

/** «Con IA»: reels de un versículo escritos por Claude (RVR1960, confirmado por la persona). */
export function ConIA() {
  const [lista, setLista] = useState<Creacion[] | null>(null);
  const [abierta, setAbierta] = useState<Creacion | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [tipo, setTipo] = useState<"versiculo" | "tema">("versiculo");
  const [texto, setTexto] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void window.reels!.listarCreaciones().then(setLista); }, []);

  const crear = async () => {
    setError(null);
    setEscribiendo(true);
    const c = await window.reels!.crearCreacion({ tipo, texto: texto.trim() });
    try {
      setAbierta(await window.reels!.escribirCreacion(c.id));
    } catch (e) {
      setError(limpiar(e));
      setAbierta(c); // queda para escribirlo a mano
    } finally {
      setEscribiendo(false);
      setNuevo(false);
    }
  };

  if (abierta) {
    return (
      <EditorVersiculo creacion={abierta} error={error}
        alVolver={() => { setAbierta(null); setError(null); void window.reels!.listarCreaciones().then(setLista); }} />
    );
  }

  return (
    <section className="pantalla" aria-labelledby="t-ia">
      <div className="pantalla-cabeza">
        <h1 id="t-ia">Con IA</h1>
        {!nuevo && <button type="button" className="btn primario" onClick={() => setNuevo(true)}><Plus size={16} aria-hidden="true" />Nuevo reel de versículo</button>}
      </div>
      <p className="ayuda">Un reel corto con un versículo en Reina-Valera 1960, una frase de reflexión, fondo animado y música. Claude lo prepara y tú revisas el texto antes de publicar.</p>

      {nuevo && (
        <div className="tarjeta-nuevo">
          <div className="fila" role="radiogroup" aria-label="Qué quieres">
            <label className="opcion"><input type="radio" name="tipo" checked={tipo === "versiculo"} onChange={() => setTipo("versiculo")} /> Un versículo</label>
            <label className="opcion"><input type="radio" name="tipo" checked={tipo === "tema"} onChange={() => setTipo("tema")} /> Un tema</label>
          </div>
          <label className="campo">{tipo === "versiculo" ? "Versículo" : "Tema"}
            <input className="entrada" value={texto} autoFocus placeholder={tipo === "versiculo" ? "Juan 8:12" : "Esperanza en medio de la prueba"} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <div className="fila">
            <button type="button" className="btn primario" disabled={!texto.trim() || escribiendo} onClick={() => void crear()}>
              {escribiendo ? <LoaderCircle size={16} className="girar" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
              {escribiendo ? "Claude está escribiendo…" : "Crear con Claude"}
            </button>
            <button type="button" className="btn fantasma" disabled={escribiendo} onClick={() => setNuevo(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {lista && lista.length === 0 && !nuevo && <p className="vacio">Todavía no hay reels de versículos. Toca «Nuevo reel de versículo» para crear el primero.</p>}
      {lista && lista.length > 0 && (
        <ul className="lista-ia" aria-label="Reels de versículos">
          {lista.map((c) => (
            <li key={c.id}>
              <button type="button" className="item-ia" onClick={() => setAbierta(c)}>
                <BookOpen size={18} aria-hidden="true" />
                <span><b>{c.versiculo.ref || c.entrada.texto}</b><small>{c.gancho || "Sin escribir"}</small></span>
                <span className={`estado ${c.estado}`}>{c.estado === "exportado" ? "Exportado" : c.versiculo.confirmado ? "Listo" : "Por revisar"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
