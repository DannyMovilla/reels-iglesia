import { spawn } from "node:child_process";
import type { Chequeo, EstadoSistema } from "@shared/api";
import { ejecutarConProgreso } from "../procesos/lineas";
import { buscarPython } from "./preparar";

export interface DepsVerificar {
  python: string;
  claude: string;
  claudeArgs?: string[];
  /** false: no se consulta a Claude (la revisión al abrir la app no gasta uso de la suscripción). */
  revisarClaude?: boolean;
  ejecutar?: (cmd: string, args: string[], op?: Parameters<typeof ejecutarConProgreso>[2]) => ReturnType<typeof ejecutarConProgreso>;
}

const SCRIPT_PYTHON = "import faster_whisper, cv2, ctranslate2; print(ctranslate2.get_cuda_device_count())";

async function revisarFfmpeg(ej: NonNullable<DepsVerificar["ejecutar"]>): Promise<Chequeo> {
  try {
    const r = await ej("ffmpeg", ["-version"]);
    const v = /ffmpeg version (\d+(?:\.\d+)*)/.exec(r.stdout);
    if (r.codigo === 0) return { ok: true, detalle: v ? `FFmpeg ${v[1]}` : "FFmpeg instalado" };
  } catch {
    /* no instalado */
  }
  return { ok: false, detalle: "FFmpeg no está instalado.", accion: "instalar-ffmpeg" };
}

async function revisarPython(ej: NonNullable<DepsVerificar["ejecutar"]>, python: string): Promise<{ python: Chequeo; gpu: Chequeo }> {
  try {
    const r = await ej(python, ["-c", SCRIPT_PYTHON], { env: { ...process.env, PYTHONUTF8: "1" } });
    if (r.codigo === 0) {
      const gpus = Number(r.stdout.trim().split(/\r?\n/).pop());
      return {
        python: { ok: true, detalle: "Python y modelos listos" },
        gpu: { ok: true, detalle: gpus > 0 ? "GPU NVIDIA lista" : "Se usará la CPU (más lento)" },
      };
    }
  } catch {
    /* falta el .venv */
  }
  const hayPython = await buscarPython(ej);
  return {
    python: hayPython
      ? { ok: false, detalle: "Falta preparar el entorno de Python de la app (unos 3 GB, una sola vez).", accion: "crear-venv" }
      : { ok: false, detalle: "No encuentro Python en esta PC.", accion: "instalar-python" },
    gpu: { ok: false, detalle: "No se pudo revisar: falta el entorno de Python." },
  };
}

async function revisarClaude(ej: NonNullable<DepsVerificar["ejecutar"]>, claude: string, extra: string[]): Promise<Chequeo> {
  let r;
  try {
    r = await ej(claude, [...extra, "-p", "ok", "--output-format", "json"]);
  } catch {
    return { ok: false, detalle: "Claude Code no está instalado en esta PC." };
  }
  try {
    const salida = JSON.parse(r.stdout.trim().split(/\r?\n/).pop() ?? "");
    if (!salida.is_error) return { ok: true, detalle: "Sesión iniciada" };
    if (/not logged in|\/login/i.test(salida.result ?? "")) {
      return { ok: false, detalle: "Falta iniciar sesión en Claude.", accion: "iniciar-sesion-claude" };
    }
    return { ok: false, detalle: `Claude respondió con un error: ${salida.result}` };
  } catch {
    return { ok: false, detalle: "Claude no respondió. Revisa tu conexión a internet." };
  }
}

export async function verificarSistema(deps: DepsVerificar): Promise<EstadoSistema> {
  const ej = deps.ejecutar ?? ((c: string, a: string[], op?: Parameters<typeof ejecutarConProgreso>[2]) => ejecutarConProgreso(c, a, op));
  const claudeSinRevisar: Chequeo = { ok: true, detalle: "Toca «Comprobar» para revisar la sesión de Claude.", accion: "comprobar-claude" };
  const [ffmpeg, py, claude] = await Promise.all([
    revisarFfmpeg(ej), revisarPython(ej, deps.python),
    deps.revisarClaude === false ? Promise.resolve(claudeSinRevisar) : revisarClaude(ej, deps.claude, deps.claudeArgs ?? []),
  ]);
  return { ffmpeg, python: py.python, gpu: py.gpu, claude };
}

/** Abre una terminal con Claude Code para que la persona inicie sesión con /login. */
export function abrirInicioSesionClaude(claude: string): void {
  spawn("cmd.exe", ["/c", "start", "Iniciar sesión en Claude", "cmd", "/k", `echo Escribe /login, presiona Enter y sigue los pasos en el navegador. & ${claude}`], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  }).unref();
}
