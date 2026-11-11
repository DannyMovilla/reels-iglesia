import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { configurarRegistro, envolverManejador } from "../../src/main/registro";
import { ejecutarConProgreso } from "../../src/main/procesos/lineas";
import { Cola, type Ejecutor } from "../../src/main/cola/cola";

let carpeta: string;
beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), "reels-eventos-"));
  configurarRegistro({ carpeta });
});
const registro = () => readdirSync(carpeta).map((f) => readFileSync(join(carpeta, f), "utf8")).join("");
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("un canal IPC que falla queda en el registro y el error sigue hacia la ventana", async () => {
  const f = envolverManejador("x:y", () => { throw new Error("No hay transcripción."); });
  await expect(f()).rejects.toThrow("No hay transcripción.");
  expect(registro()).toMatch(/ error ipc x:y: No hay transcripción\.\n$/);
});

test("un canal largo anota inicio, fin y duración", async () => {
  const f = envolverManejador("entregas:pdf", async (a: number) => a * 2, { largo: true });
  await expect(f(21)).resolves.toBe(42);
  expect(registro()).toMatch(/ info ipc inicio entregas:pdf\n.* info ipc fin entregas:pdf en 0 s\n$/);
});

test("un proceso hijo que falla deja el final de su stderr", async () => {
  const r = await ejecutarConProgreso("node", ["-e", "console.error('a\\nb'); process.exit(3)"]);
  expect(r.codigo).toBe(3);
  expect(registro()).toMatch(/ aviso proceso node salió con 3: a \| b\n$/);
});

test("un proceso que termina bien no anota nada", async () => {
  await ejecutarConProgreso("node", ["-e", "console.error('aviso sin importancia')"]);
  expect(registro()).toBe("");
});

test("la cola anota el inicio y el fin de cada tarea, con el error si falla", async () => {
  const falla: Ejecutor = async () => { await espera(5); throw new Error("sin GPU"); };
  const ok: Ejecutor = async () => undefined;
  const cola = new Cola(join(carpeta, "cola.json"), { transcribir: falla, caras: ok, audio: ok, analizar: ok, exportar: ok, "exportar-ia": ok });
  await cola.cargar();
  cola.agregar("p1", "transcribir");
  const t0 = Date.now();
  while (!cola.lista().every((t) => t.estado === "error")) {
    if (Date.now() - t0 > 3000) throw new Error("tiempo agotado");
    await espera(10);
  }
  const r = registro();
  expect(r).toMatch(/ info cola inicio transcribir p1\n/);
  expect(r).toMatch(/ error cola error transcribir p1 en 0 s: sin GPU\n/);
});
