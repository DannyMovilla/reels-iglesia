import { useEffect, useState } from "react";
import { Music, Plus } from "lucide-react";
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
        <div className="estado-vacio">
          <Music size={28} aria-hidden="true" />
          <b>Todavía no hay pistas propias</b>
          <p>Agrega MP3 o WAV que tengas permiso de usar y asígnales un ánimo. Mientras tanto, los reels usan pads generados en tu PC.</p>
          <button type="button" className="btn primario" onClick={() => void agregar()}><Plus size={16} aria-hidden="true" />Agregar mis pistas</button>
        </div>
      )}
      {pistas && pistas.length > 0 && ANIMOS.filter((a) => pistas.some((p) => p.animo === a)).map((a) => {
        const del = pistas.filter((p) => p.animo === a);
        return (
          <section key={a} className="grupo-pistas" aria-labelledby={`animo-${a}`}>
            <div className="fila"><h2 id={`animo-${a}`}>{NOMBRE_ANIMO[a]}</h2><span className="tenue">{del.length === 1 ? "1 pista" : `${del.length} pistas`}</span></div>
            <ul className="pistas" aria-label={`Pistas de ${NOMBRE_ANIMO[a]}`}>
              {del.map((p) => (
                <li key={p.id} className="pista">
                  <div className="pista-datos">
                    <b>{p.titulo}</b>
                    <span className="mono">{formatoTiempo(p.duracion)}</span>
                  </div>
                  <audio controls preload="none" src={window.reels!.urlPista(p.id)} aria-label={`Escuchar ${p.titulo}`} />
                  <select className="entrada" aria-label={`Ánimo de ${p.titulo}`} value={p.animo} onChange={(e) => cambiar(p, e.target.value as Animo)}>
                    {ANIMOS.map((x) => <option key={x} value={x}>{NOMBRE_ANIMO[x]}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
