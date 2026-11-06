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

/** Lo que imprime HyperFrames al fallar → mensaje para la persona (el detalle técnico va al final). */
export function traducirErrorRender(texto: string): string {
  const t = texto.trim();
  if (/ffmpeg[^\n]*(ENOENT|not found|no se reconoce)/i.test(t)) return "Falta FFmpeg. Abre Ajustes y toca «Instalar FFmpeg».";
  if (/requires Node\.js/i.test(t)) return "Hay que actualizar Reels Iglesia para exportar (versión de Node). Instala la última versión.";
  if (/ENOSPC|no space left/i.test(t)) return "No hay espacio en el disco para exportar el reel. Libera espacio y reintenta.";
  if (/refused to start the browser|failed to launch the browser|could not find (chrome|browser)|spawn UNKNOWN/i.test(t)) {
    return "No se pudo abrir el navegador del render. Abre Ajustes y toca «Preparar el entorno».";
  }
  const ultima = t.split(/\r?\n/).filter((l) => l.trim()).at(-1) ?? "";
  return `No se pudo exportar el reel.\n\nDetalle: ${ultima}`;
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
    throw new Error(traducirErrorRender(`${r.stderr}\n${r.stdout}`));
  }
}
