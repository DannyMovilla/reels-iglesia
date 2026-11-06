import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { ejecutarConProgreso, type Progreso } from "../../src/main/procesos/lineas";

const RAIZ = resolve(__dirname, "../..");
const PYTHON = join(RAIZ, ".venv", "Scripts", "python.exe");

test("transcribe y detecta caras de un video con espacios, paréntesis y ñ en el nombre", async () => {
  const fixture = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], {
    encoding: "utf8",
  }).trim().split(/\r?\n/).pop()!;
  expect(fixture).toContain("culto (prueba) ñ.mp4");
  const salida = mkdtempSync(join(tmpdir(), "reels-trans-"));
  const progresos: Progreso[] = [];
  const r = await ejecutarConProgreso(
    PYTHON,
    [join(RAIZ, "python/transcribir.py"), fixture, "--inicio", "0", "--salida", salida, "--progreso-json", "--modelo", "tiny", "--dispositivo", "cpu"],
    { alProgreso: (p) => progresos.push(p) },
  );
  expect(r.codigo, r.stderr).toBe(0);
  expect(progresos.some((p) => p.etapa === "transcripcion")).toBe(true);
  expect(progresos.some((p) => p.etapa === "caras")).toBe(true);
  const t = JSON.parse(readFileSync(join(salida, "transcripcion.json"), "utf8"));
  expect(t.segmentos.length).toBeGreaterThan(0);
  expect(t.segmentos.map((s: { t: string }) => s.t).join(" ")).toMatch(/Dios/);
  const caras = JSON.parse(readFileSync(join(salida, "caras.json"), "utf8"));
  expect(Array.isArray(caras)).toBe(true);
});
