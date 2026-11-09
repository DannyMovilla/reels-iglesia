import { useState } from "react";
import { LoaderCircle, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
import type { ClipSpec } from "@shared/tipos";

/** Un pedido a Claude sobre este clip, con el clip de antes para poder deshacerlo. */
export interface EntradaChat {
  pedido: string;
  resumen: string;
  avisos: string[];
  antes: ClipSpec;
  deshecho?: boolean;
}

interface Props {
  proyectoId: string;
  clip: ClipSpec;
  historial: EntradaChat[];
  alHistorial(h: EntradaChat[]): void;
  alAplicar(c: ClipSpec): void;
}

const ATAJOS: [string, string][] = [
  ["Menos de 60 segundos", "Hazlo de menos de 60 segundos"],
  ["Un gancho más fuerte", "Escribe un gancho más fuerte"],
  ["Quita lo que no se entiende solo", "Quita lo que no se entiende sin haber visto el resto de la prédica"],
  ["Textos más cortos", "Haz más cortos los textos para las redes"],
];

const limpiarError = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

/** Pedirle cambios a Claude en palabras ("hazlo más corto", "otro gancho"), con Deshacer. */
export function ChatClip({ proyectoId, clip, historial, alHistorial, alAplicar }: Props) {
  const [pedido, setPedido] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pedir = async () => {
    const texto = pedido.trim();
    if (!texto || pensando) return;
    setPensando(true);
    setError(null);
    try {
      const previos = historial.filter((h) => !h.deshecho).map((h) => ({ pedido: h.pedido, resumen: h.resumen }));
      const r = await window.reels!.pedirCambios(proyectoId, clip, texto, previos);
      alHistorial([...historial, { pedido: texto, resumen: r.resumen, avisos: r.avisos, antes: clip }]);
      alAplicar(r.clip);
      setPedido("");
    } catch (e) {
      setError(limpiarError(e));
    } finally {
      setPensando(false);
    }
  };

  const ultima = historial.length - 1;
  const deshacer = () => {
    const h = historial[ultima];
    if (!h || h.deshecho) return;
    alAplicar(h.antes);
    alHistorial(historial.map((x, i) => (i === ultima ? { ...x, deshecho: true } : x)));
  };

  return (
    <div className="chat-clip">
      <p className="ayuda">Pídele a Claude un cambio con tus palabras. Puede cambiar el corte, el gancho, el título, la apertura, las palabras clave, la música, los subtítulos y los textos. Nunca agrega versículos.</p>
      {historial.length > 0 && (
        <ol className="chat-historial" aria-label="Pedidos a Claude">
          {historial.map((h, i) => (
            <li key={i} className={h.deshecho ? "deshecho" : ""}>
              <p className="chat-pedido">{h.pedido}</p>
              <p className="chat-respuesta"><Sparkles size={13} aria-hidden="true" />{h.resumen}</p>
              {h.avisos.map((a) => <p key={a} className="chat-aviso"><TriangleAlert size={12} aria-hidden="true" />{a}</p>)}
              {h.deshecho ? <span className="ayuda">Deshecho</span> : i === ultima && (
                <button type="button" className="btn pequeno fantasma" onClick={deshacer}><Undo2 size={13} aria-hidden="true" />Deshacer</button>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="chat-atajos" role="group" aria-label="Pedidos rápidos">
        {ATAJOS.map(([etiqueta, texto]) => (
          <button key={etiqueta} type="button" className="chipf" disabled={pensando} onClick={() => setPedido(texto)}>{etiqueta}</button>
        ))}
      </div>
      <textarea className="entrada" rows={3} aria-label="¿Qué quieres cambiar?" placeholder="Por ejemplo: que empiece cuando dice «Dios no ha terminado contigo»"
        value={pedido} disabled={pensando} onChange={(e) => setPedido(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void pedir(); }} />
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn primario" disabled={!pedido.trim() || pensando} onClick={() => void pedir()}>
        {pensando ? <LoaderCircle size={15} className="girar" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
        {pensando ? "Claude está pensando…" : "Pedir a Claude"}
      </button>
    </div>
  );
}
