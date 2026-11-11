import { useState, type ReactNode } from "react";
import { ChevronRight, Flame, Minus, RotateCw, Square, X } from "lucide-react";
import { useActualizacion } from "../actualizacion";

/** Aviso de una versión nueva descargada: se instala al cerrar o al tocar «Reiniciar ahora» (si no hay trabajo). */
function AvisoActualizacion() {
  const estado = useActualizacion();
  const [esperando, setEsperando] = useState(false);
  if (estado?.fase !== "lista") return null;
  if (esperando) return <span className="aviso-actualizacion" role="status">Se instalará al terminar lo que está haciendo</span>;
  return (
    <span className="aviso-actualizacion" role="status">
      La versión {estado.version} está lista: se instala al cerrar
      <button type="button" className="btn pequeno" onClick={() => void window.reels!.reiniciarParaActualizar().then((ok) => { if (!ok) setEsperando(true); })}>
        <RotateCw size={13} aria-hidden="true" />Reiniciar ahora
      </button>
    </span>
  );
}

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
      {/* Huecos donde cada pantalla pone su estado y sus acciones (el editor: «Prédica lista», Guardar estilo, Exportar). */}
      <div className="barra-estado" id="barra-estado" />
      <span className="espacio" />
      <AvisoActualizacion />
      <div className="acciones" id="barra-acciones">{acciones}</div>
      <div className="ventana" aria-label="Ventana">
        <button type="button" aria-label="Minimizar" onClick={() => ventana?.minimizar()}><Minus size={16} /></button>
        <button type="button" aria-label="Maximizar" onClick={() => ventana?.maximizar()}><Square size={13} /></button>
        <button type="button" aria-label="Cerrar" onClick={() => ventana?.cerrar()}><X size={16} /></button>
      </div>
    </header>
  );
}
