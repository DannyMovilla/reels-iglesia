import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

/** Una categoría del riel. `aviso`: algo pendiente (punto dorado y descripción para lectores de pantalla). */
export interface CategoriaRiel<C extends string> {
  id: C;
  nombre: string;
  titulo: string;
  ayuda: string;
  Icono: LucideIcon;
  /** Con una línea encima, separada del grupo de arriba. */
  separado?: boolean;
  aviso?: string;
}

/** Sección plegable de una categoría: la cabecera muestra cómo está ahora («Tamaño · Medio»). */
export function Seccion({ titulo, resumen, children, abierta = true }: { titulo: string; resumen?: string; children: ReactNode; abierta?: boolean }) {
  const [abierto, setAbierto] = useState(abierta);
  return (
    <section className="seccion">
      <h3>
        <button type="button" className="seccion-cabeza" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
          <span className="seccion-titulo">{titulo}</span>
          {resumen && <span className="seccion-resumen">{resumen}</span>}
          <ChevronRight size={15} className="seccion-flecha" aria-hidden="true" />
        </button>
      </h3>
      {abierto && <div className="seccion-cuerpo">{children}</div>}
    </section>
  );
}

interface Props<C extends string> {
  /** Nombre del riel para lectores de pantalla. */
  etiqueta: string;
  categorias: CategoriaRiel<C>[];
  actual: C;
  alElegir(c: C): void;
  /** Lo que va a la derecha del título (por ejemplo, un interruptor). */
  cabeza?: ReactNode;
  children: ReactNode;
}

/** Panel de ajustes por categorías: una categoría a la vez, elegida en el riel del borde (flechas arriba/abajo). */
export function PanelCategorias<C extends string>({ etiqueta, categorias, actual, alElegir, cabeza, children }: Props<C>) {
  const id = useId();
  const riel = useRef<HTMLDivElement>(null);
  const cat = categorias.find((k) => k.id === actual) ?? categorias[0];
  const mover = (e: KeyboardEvent, i: number) => {
    const paso = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    const j = (i + paso + categorias.length) % categorias.length;
    alElegir(categorias[j].id);
    riel.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[j]?.focus();
  };
  return (
    <div className="inspector">
      <div className="inspector-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${cat.id}`}>
        <div className="panel-cabeza">
          <div className="panel-titulo">
            <h2>{cat.titulo}</h2>
            {cabeza}
          </div>
          <p>{cat.ayuda}</p>
        </div>
        <div className="inspector-cuerpo">{children}</div>
      </div>

      <div className="riel-categorias" role="tablist" aria-label={etiqueta} aria-orientation="vertical" ref={riel}>
        {categorias.map((k, i) => (
          <button key={k.id} id={`${id}-${k.id}`} type="button" role="tab" aria-selected={k.id === cat.id} aria-controls={`${id}-panel`}
            tabIndex={k.id === cat.id ? 0 : -1} className={k.separado ? "separado" : undefined}
            aria-describedby={k.aviso ? `${id}-aviso-${k.id}` : undefined}
            onClick={() => alElegir(k.id)} onKeyDown={(e) => mover(e, i)}>
            {k.aviso && <span className="riel-punto" aria-hidden="true" />}
            <k.Icono size={19} aria-hidden="true" />{k.nombre}
          </button>
        ))}
        {categorias.filter((k) => k.aviso).map((k) => <span key={k.id} id={`${id}-aviso-${k.id}`} hidden>{k.aviso}</span>)}
      </div>
    </div>
  );
}
