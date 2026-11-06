import { expect, test } from "vitest";
import { verificarSistema } from "../../../src/main/sistema/verificar";
import type { ResultadoProceso } from "../../../src/main/procesos/lineas";

type Respuestas = { ffmpeg?: ResultadoProceso; python?: ResultadoProceso; claude?: ResultadoProceso | Error };
const ok = (stdout: string): ResultadoProceso => ({ codigo: 0, stdout, stderr: "" });

function falso(r: Respuestas) {
  return async (cmd: string): Promise<ResultadoProceso> => {
    if (cmd === "ffmpeg") return r.ffmpeg ?? ok("ffmpeg version 9.0.2-full_build Copyright\n");
    if (cmd === "py.exe") return r.python ?? ok("1\n");
    const c = r.claude ?? ok('{"type":"result","is_error":false,"result":"ok"}');
    if (c instanceof Error) throw c;
    return c;
  };
}

test("sin sesión de Claude pide iniciar sesión", async () => {
  const e = await verificarSistema({
    python: "py.exe", claude: "claude",
    ejecutar: falso({ claude: { codigo: 1, stdout: '{"is_error":true,"result":"Not logged in · Please run /login"}', stderr: "" } }),
  });
  expect(e.claude.ok).toBe(false);
  expect(e.claude.accion).toBe("iniciar-sesion-claude");
});

test("sin GPU NVIDIA sigue funcionando con la CPU", async () => {
  const e = await verificarSistema({ python: "py.exe", claude: "claude", ejecutar: falso({ python: ok("0\n") }) });
  expect(e.gpu.ok).toBe(true);
  expect(e.gpu.detalle).toBe("Se usará la CPU (más lento)");
});

test("con todo instalado, todo queda en ok", async () => {
  const e = await verificarSistema({ python: "py.exe", claude: "claude", ejecutar: falso({}) });
  expect(e.ffmpeg).toEqual({ ok: true, detalle: "FFmpeg 9.0.2" });
  expect(e.python.ok).toBe(true);
  expect(e.gpu.detalle).toBe("GPU NVIDIA lista");
  expect(e.claude).toEqual({ ok: true, detalle: "Sesión iniciada" });
});

test("si Claude Code no está instalado lo dice", async () => {
  const e = await verificarSistema({ python: "py.exe", claude: "claude", ejecutar: falso({ claude: new Error("spawn claude ENOENT") }) });
  expect(e.claude).toEqual({ ok: false, detalle: "Claude Code no está instalado en esta PC." });
});

test("si falta el entorno de Python ofrece crearlo", async () => {
  const e = await verificarSistema({
    python: "py.exe", claude: "claude",
    ejecutar: falso({ python: { codigo: 1, stdout: "", stderr: "ModuleNotFoundError: No module named 'faster_whisper'" } }),
  });
  expect(e.python.ok).toBe(false);
  expect(e.python.accion).toBe("crear-venv");
  expect(e.gpu.ok).toBe(false);
});
