import { ScanLine } from "lucide-react";
import type { Formato } from "@shared/tipos";
import { NOMBRE_RED_ZONA, ZONAS, type Red } from "@shared/reel/zonas";

const ALTOS: Record<Formato, number> = { "9:16": 1920, "4:5": 1350, "1:1": 1080 };
export type RedZona = Red | "ninguna";

/** Lo que tapa la red elegida (botones, nombre, descripción), dibujado sobre la vista previa. */
export function ZonaSegura({ red, formato }: { red: RedZona; formato: Formato }) {
  if (red === "ninguna") return null;
  const z = ZONAS[red][formato], H = ALTOS[formato];
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  return (
    <div className="zona-segura" aria-hidden="true" data-red={red}>
      <div className="zs-arriba" style={{ height: pct(z.arriba, H) }} />
      <div className="zs-abajo" style={{ height: pct(z.abajo, H) }} />
      <div className="zs-izquierda" style={{ top: pct(z.arriba, H), bottom: pct(z.abajo, H), width: pct(z.izquierda, 1080) }} />
      <div className="zs-derecha" style={{ top: pct(z.arriba, H), bottom: pct(z.abajo, H), width: pct(z.derecha, 1080) }} />
      <span style={{ bottom: `calc(${pct(z.abajo, H)} + 6px)` }}>{NOMBRE_RED_ZONA[red]} tapa estas zonas</span>
    </div>
  );
}

/** Selector de la red cuya zona segura se dibuja. */
export function SelectorZona({ valor, alCambiar }: { valor: RedZona; alCambiar(r: RedZona): void }) {
  return (
    <label className="selector-zona">
      <ScanLine size={14} aria-hidden="true" />
      <select aria-label="Zona segura" value={valor} onChange={(e) => alCambiar(e.target.value as RedZona)}>
        {(Object.keys(NOMBRE_RED_ZONA) as Red[]).map((r) => <option key={r} value={r}>{NOMBRE_RED_ZONA[r]}</option>)}
        <option value="ninguna">Sin zona segura</option>
      </select>
    </label>
  );
}
