import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ejecutarConProgreso, type OpcionesProceso, type ResultadoProceso } from "../procesos/lineas";

type Ejecutar = (cmd: string, args: string[], op?: OpcionesProceso) => Promise<ResultadoProceso>;

/** Un Python 3.11+ instalado en la PC: py -3.12, py -3 o python. null si no hay. */
export async function buscarPython(ejecutar: Ejecutar): Promise<[string, string[]] | null> {
  for (const [cmd, args] of [["py", ["-3.12"]], ["py", ["-3"]], ["python", []]] as [string, string[]][]) {
    try {
      const r = await ejecutar(cmd, [...args, "--version"]);
      const m = /Python (\d+)\.(\d+)/.exec(`${r.stdout} ${r.stderr}`);
      if (r.codigo === 0 && m && (Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 11))) return [cmd, args];
    } catch {
      /* no está */
    }
  }
  return null;
}

/** winget sin más preguntas (la persona ya tocó "Instalar"). */
export const argsWinget = (id: string): string[] => ["install", "--id", id, "-e", "--accept-source-agreements", "--accept-package-agreements"];

function traducirPip(stderr: string): string {
  if (/no space left|errno 28/i.test(stderr)) return "No hay espacio suficiente en el disco para instalar los modelos (hacen falta unos 3 GB). Libera espacio y vuelve a intentar.";
  if (/connection|getaddrinfo|timed out|could not fetch|network/i.test(stderr)) return "No hay conexión a internet. Hace falta internet para descargar los componentes la primera vez.";
  return `No se pudo instalar lo necesario. ${stderr.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? ""}`.trim();
}

export interface OpcionesPreparar {
  destino: string;
  requisitos: string;
  /** Comando que deja listo el navegador del render de HyperFrames (hyperframes browser ensure). */
  navegador: [string, string[]];
  senal: AbortSignal;
  alProgreso(pct: number, texto?: string): void;
  ejecutar?: Ejecutar;
}

/** Crea el entorno de Python de la app e instala sus paquetes; al final, el navegador del render. */
export async function prepararEntorno(op: OpcionesPreparar): Promise<void> {
  const ej = op.ejecutar ?? ((c: string, a: string[], o?: OpcionesProceso) => ejecutarConProgreso(c, a, o));
  const py = await buscarPython(ej);
  if (!py) throw new Error("No encuentro Python en esta PC. Instala Python (botón «Instalar Python») y vuelve a intentar.");

  op.alProgreso(2, "Creando el entorno…");
  const venv = await ej(py[0], [...py[1], "-m", "venv", op.destino], { senal: op.senal });
  if (venv.codigo !== 0) throw new Error(`No se pudo crear el entorno de Python. ${venv.stderr.trim().split(/\r?\n/).at(-1) ?? ""}`.trim());

  const paquetes = (await readFile(op.requisitos, "utf8")).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).length;
  let vistos = 0;
  op.alProgreso(5, "Descargando los modelos y componentes…");
  const pip = await ej(join(op.destino, "Scripts", "python.exe"), ["-m", "pip", "install", "--progress-bar", "off", "-r", op.requisitos], {
    senal: op.senal,
    env: { ...process.env, PYTHONUTF8: "1" },
    alLinea: (l) => {
      const m = /^Collecting (\S+)/.exec(l.trim());
      if (m && vistos < paquetes) {
        vistos++;
        op.alProgreso(5 + Math.round((vistos / Math.max(1, paquetes)) * 80), `Instalando ${m[1]}…`);
      }
    },
  });
  if (pip.codigo !== 0) throw new Error(traducirPip(pip.stderr));

  op.alProgreso(88, "Preparando el navegador del render…");
  const nav = await ej(op.navegador[0], op.navegador[1], { senal: op.senal, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
  if (nav.codigo !== 0) throw new Error(traducirPip(nav.stderr));
  op.alProgreso(100, "Listo");
}
