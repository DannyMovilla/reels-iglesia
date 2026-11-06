import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { Pista } from "@shared/reel/pistas";
import { ANIMOS, type Animo } from "@shared/tipos";
import { formatoTiempo } from "@shared/validar";

export const NOMBRE_ANIMO: Record<Animo, string> = {
  reflexivo: "Reflexivo", esperanza: "Esperanza", victoria: "Victoria", adoracion: "Adoración", tension: "Tensión",
};

/** Música de fondo propia de la iglesia; cuando no hay pista del ánimo del clip, la app genera un pad. */
export function Musica() {
  const [pistas, setPistas] = useState<Pista[] | null>(null);

  const cargar = () => void window.reels!.listarPistas().then(setPistas);
  useEffect(cargar, []);

  const agregar = async () => {
    const nuevas = await window.reels!.agregarPistas();
    if (nuevas.length) cargar();
  };

  const cambiar = (p: Pista, animo: Animo) => {
    setPistas((ps) => ps?.map((x) => (x.id === p.id ? { ...x, animo } : x)) ?? null);
    void window.reels!.cambiarAnimo(p.id, animo);
  };

  return (
    <section className="pantalla" aria-labelledby="t-musica">
      <div className="pantalla-cabeza">
        <h1 id="t-musica">Música</h1>
        <button type="button" className="btn primario" onClick={() => void agregar()}><Plus size={16} aria-hidden="true" />Agregar mis pistas</button>
      </div>
      <p className="ayuda">
        Claude elige para cada reel una pista del ánimo del mensaje y no repite la misma seguida. Si no hay ninguna de ese ánimo,
        la app crea un pad (un fondo suave de sintetizador) en el momento. Usa música que tengas permiso de usar, por ejemplo de Pixabay.
      </p>
      {pistas && pistas.length === 0 && (
        <p className="vacio">Todavía no agregaste pistas: por ahora los reels usarán pads generados en tu PC.</p>
      )}
      {pistas && pistas.length > 0 && (
        <ul className="pistas" aria-label="Pistas">
          {pistas.map((p) => (
            <li key={p.id} className="pista">
              <div className="pista-datos">
                <b>{p.titulo}</b>
                <span className="mono">{formatoTiempo(p.duracion)}</span>
              </div>
              <audio controls preload="none" src={window.reels!.urlPista(p.id)} aria-label={`Escuchar ${p.titulo}`} />
              <select className="entrada" aria-label={`Ánimo de ${p.titulo}`} value={p.animo} onChange={(e) => cambiar(p, e.target.value as Animo)}>
                {ANIMOS.map((a) => <option key={a} value={a}>{NOMBRE_ANIMO[a]}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
