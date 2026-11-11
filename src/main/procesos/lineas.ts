import { spawn, spawnSync } from "node:child_process";
import { basename } from "node:path";
import { registrar } from "../registro";

export interface Progreso {
  etapa: string;
  pct: number;
  texto?: string;
}

export interface OpcionesProceso {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  entrada?: string;
  alProgreso?(p: Progreso): void;
  /** Cada línea de stdout que no es progreso JSON (p. ej. "@hf-progress {...}" de HyperFrames). */
  alLinea?(linea: string): void;
  senal?: AbortSignal;
}

export interface ResultadoProceso {
  codigo: number;
  stdout: string;
  stderr: string;
}

function esProgreso(linea: string): Progreso | null {
  const t = linea.trim();
  if (!t.startsWith("{") || !t.includes('"etapa"')) return null;
  try {
    const v = JSON.parse(t);
    return typeof v?.etapa === "string" && typeof v?.pct === "number" ? v : null;
  } catch {
    return null;
  }
}

/** Ejecuta sin shell (rutas con espacios, paréntesis y acentos llegan intactas) y reporta el progreso JSON por líneas. */
export function ejecutarConProgreso(cmd: string, args: string[], op: OpcionesProceso = {}): Promise<ResultadoProceso> {
  return new Promise((resolve, reject) => {
    const hijo = spawn(cmd, args, { cwd: op.cwd, env: op.env ?? process.env, windowsHide: true });
    let stdout = "", stderr = "", pendiente = "";
    hijo.stdout.setEncoding("utf8");
    hijo.stderr.setEncoding("utf8");
    hijo.stdout.on("data", (trozo: string) => {
      const lineas = (pendiente + trozo).split("\n");
      pendiente = lineas.pop() ?? "";
      for (const l of lineas) {
        const p = esProgreso(l);
        if (p) op.alProgreso?.(p);
        else {
          stdout += l.replace(/\r$/, "") + "\n";
          op.alLinea?.(l.replace(/\r$/, ""));
        }
      }
    });
    hijo.stderr.on("data", (t: string) => (stderr += t));
    // Si el hijo termina antes de leer la entrada (o no arrancó), Node emite EPIPE en stdin: se ignora,
    // el resultado llega por "close"/"error".
    hijo.stdin.on("error", () => undefined);
    hijo.stdin.end(op.entrada ?? "", "utf8");
    const matar = () => {
      if (hijo.pid === undefined || hijo.exitCode !== null) return;
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(hijo.pid), "/T", "/F"], { windowsHide: true });
      else hijo.kill("SIGKILL");
    };
    if (op.senal?.aborted) matar();
    op.senal?.addEventListener("abort", matar, { once: true });
    hijo.on("error", reject);
    hijo.on("close", (codigo) => {
      op.senal?.removeEventListener("abort", matar);
      if (pendiente) {
        const p = esProgreso(pendiente);
        if (p) op.alProgreso?.(p);
        else stdout += pendiente;
      }
      const c = codigo ?? 1;
      if (c !== 0) {
        const cola = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-20).join(" | ");
        registrar("aviso", "proceso", `${basename(cmd)} salió con ${c}${cola ? `: ${cola}` : ""}`);
      }
      resolve({ codigo: c, stdout, stderr });
    });
  });
}
