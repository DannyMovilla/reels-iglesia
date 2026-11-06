import type { ReactNode } from "react";
import { ChevronRight, Flame, Minus, Square, X } from "lucide-react";

interface Props {
  migas: string[];
  acciones?: ReactNode;
}

export function BarraTitulo({ migas, acciones }: Props) {
  const ventana = window.reels?.ventana;
  return (
    <header className="barra-titulo">
      <div className="marca">
        <span className="marca-icono"><Flame size={14} strokeWidth={2.4} aria-hidden="true" /></span>
        Reels Iglesia
      </div>
      {migas.length > 0 && (
        <nav className="migas" aria-label="Ubicación">
          {migas.map((m, i) => (
            <span key={m + i} style={{ display: "contents" }}>
              <ChevronRight size={14} aria-hidden="true" />
              {i === migas.length - 1 ? <b>{m}</b> : <span>{m}</span>}
            </span>
          ))}
        </nav>
      )}
      <span className="espacio" />
      {acciones && <div className="acciones">{acciones}</div>}
      <div className="ventana" aria-label="Ventana">
        <button type="button" aria-label="Minimizar" onClick={() => ventana?.minimizar()}><Minus size={16} /></button>
        <button type="button" aria-label="Maximizar" onClick={() => ventana?.maximizar()}><Square size={13} /></button>
        <button type="button" aria-label="Cerrar" onClick={() => ventana?.cerrar()}><X size={16} /></button>
      </div>
    </header>
  );
}
