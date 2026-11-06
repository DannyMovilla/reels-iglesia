import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { argsWinget, buscarPython, prepararEntorno } from "../../../src/main/sistema/preparar";
import type { OpcionesProceso, ResultadoProceso } from "../../../src/main/procesos/lineas";

const ok = (stdout = ""): ResultadoProceso => ({ codigo: 0, stdout, stderr: "" });
const mal = (stderr: string): ResultadoProceso => ({ codigo: 1, stdout: "", stderr });

test("busca un Python 3.10 o más nuevo: primero py -3.12, luego py -3, luego python", async () => {
  const probados: string[] = [];
  const ej = async (cmd: string, args: string[]) => {
    probados.push([cmd, ...args].join(" "));
    if (cmd === "py" && args[0] === "-3.12") throw Object.assign(new Error("no"), { code: "ENOENT" });
    if (cmd === "py") return ok("Python 3.9.7");
    return ok("Python 3.11.4");
  };
  expect(await buscarPython(ej)).toEqual(["python", []]);
  expect(probados).toEqual(["py -3.12 --version", "py -3 --version", "python --version"]);
  expect(await buscarPython(async () => { throw Object.assign(new Error("no"), { code: "ENOENT" }); })).toBeNull();
});

test("prepara el entorno: crea el venv, instala los paquetes con progreso y deja listo el navegador del render", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reels-env-"));
  const req = join(dir, "requirements.txt");
  writeFileSync(req, "# comentario\nfaster-whisper==1.2.1\nnumpy==2.5.4\nyt-dlp\n");
  const llamadas: string[][] = [];
  const progreso: number[] = [];
  const ej = async (cmd: string, args: string[], op?: OpcionesProceso) => {
    llamadas.push([cmd, ...args]);
    if (args.includes("pip")) for (const p of ["faster-whisper", "numpy", "yt-dlp"]) op?.alLinea?.(`Collecting ${p}`);
    return ok("Python 3.12.1");
  };
  await prepararEntorno({ ejecutar: ej, destino: join(dir, "venv"), requisitos: req, navegador: ["node", ["hf.mjs", "browser", "ensure"]],
    senal: new AbortController().signal, alProgreso: (p) => progreso.push(p) });
  expect(llamadas.find((l) => l.includes("venv"))).toEqual(["py", "-3.12", "-m", "venv", join(dir, "venv")]);
  const pip = llamadas.find((l) => l.includes("pip"))!;
  expect(pip[0]).toBe(join(dir, "venv", "Scripts", "python.exe"));
  expect(pip.slice(1)).toEqual(["-m", "pip", "install", "--progress-bar", "off", "-r", req]);
  expect(llamadas.at(-1)).toEqual(["node", "hf.mjs", "browser", "ensure"]);
  expect(progreso.at(-1)).toBe(100);
  for (let i = 1; i < progreso.length; i++) expect(progreso[i]).toBeGreaterThanOrEqual(progreso[i - 1]);
});

test.each([
  ["ERROR: Could not install packages due to an OSError: [Errno 28] No space left on device", /espacio/],
  ["WARNING: Retrying ... ConnectionError ... getaddrinfo failed\nERROR: Could not find a version", /internet/],
])("errores de pip en español: %s", async (stderr, mensaje) => {
  const dir = mkdtempSync(join(tmpdir(), "reels-env-"));
  const req = join(dir, "r.txt");
  writeFileSync(req, "numpy\n");
  const ej = async (_c: string, args: string[]) => (args.includes("pip") ? mal(stderr) : ok("Python 3.12.1"));
  await expect(prepararEntorno({ ejecutar: ej, destino: join(dir, "venv"), requisitos: req, navegador: ["n", []], senal: new AbortController().signal, alProgreso: () => {} }))
    .rejects.toThrow(mensaje);
});

test("sin Python avisa que hay que instalarlo", async () => {
  const ej = async () => { throw Object.assign(new Error("no"), { code: "ENOENT" }); };
  await expect(prepararEntorno({ ejecutar: ej, destino: "x", requisitos: "r", navegador: ["n", []], senal: new AbortController().signal, alProgreso: () => {} }))
    .rejects.toThrow(/Instala Python/);
});

test("winget instala sin preguntar de nuevo (la persona ya tocó el botón)", () => {
  expect(argsWinget("Gyan.FFmpeg")).toEqual(["install", "--id", "Gyan.FFmpeg", "-e", "--accept-source-agreements", "--accept-package-agreements"]);
});
