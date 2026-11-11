import type { EstadoSistema } from "@shared/api";

export interface DatosDiagnostico {
  version: string;
  electron: string;
  windows: string;
  cpu: string;
  ramGb: number;
  gpu: string;
  estado: EstadoSistema;
  lineas: string[];
}

/**
 * Texto de «Copiar diagnóstico»: versión, sistema, chequeos y el final del registro. Se copia al portapapeles para
 * mandarlo a quien da soporte; la app nunca lo envía sola.
 */
export function textoDiagnostico(d: DatosDiagnostico): string {
  const chequeos = [d.estado.ffmpeg, d.estado.python, d.estado.gpu, d.estado.claude].map((c) => `${c.ok ? "✔" : "✘"} ${c.detalle}`);
  return [
    `Reels Iglesia ${d.version}`,
    "",
    "Sistema",
    `Windows ${d.windows} · Electron ${d.electron}`,
    `CPU: ${d.cpu} · RAM: ${d.ramGb} GB`,
    `GPU: ${d.gpu}`,
    "",
    "Chequeos",
    ...chequeos,
    "",
    `Registro (últimas ${d.lineas.length} líneas)`,
    ...(d.lineas.length ? d.lineas : ["(el registro está vacío)"]),
    "",
  ].join("\n");
}
