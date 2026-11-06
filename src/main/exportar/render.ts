import { join } from "node:path";
import { ejecutarConProgreso } from "../procesos/lineas";
import { raizApp } from "../rutas";

/** "@hf-progress {...,"pct":25}" → 25; cualquier otra línea → null. */
export function progresoHyperframes(linea: string): number | null {
  const m = /^@hf-progress\s+(\{.*\})\s*$/.exec(linea.trim());
  if (!m) return null;
  try {
    const v = JSON.parse(m[1]);
    return typeof v.pct === "number" ? v.pct : null;
  } catch {
    return null;
  }
}

export interface OpcionesRender {
  gpu: boolean;
  senal: AbortSignal;
  alProgreso(pct: number): void;
  ejecutar?: typeof ejecutarConProgreso;
}

/** Renderiza la carpeta con el CLI de HyperFrames fijado en node_modules (Electron actúa como Node). */
export async function renderizar(dir: string, salida: string, op: OpcionesRender): Promise<void> {
  const ejecutar = op.ejecutar ?? ejecutarConProgreso;
  const cli = join(raizApp(), "node_modules", "hyperframes", "bin", "hyperframes.mjs");
  const args = [cli, "render", "--workers", "4", "--video-bitrate", "10M", "-o", salida];
  if (op.gpu) args.push("--gpu");
  const r = await ejecutar(process.execPath, args, {
    cwd: dir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NO_COLOR: "1" },
    senal: op.senal,
    alLinea: (l) => {
      const pct = progresoHyperframes(l);
      if (pct !== null) op.alProgreso(pct);
    },
  });
  if (r.codigo !== 0) {
    const ultimas = `${r.stderr}\n${r.stdout}`.trim().split(/\r?\n/).filter(Boolean).slice(-4).join("\n");
    throw new Error(`No se pudo exportar el reel.\n${ultimas}`);
  }
}
