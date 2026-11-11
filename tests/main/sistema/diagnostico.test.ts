import { expect, test } from "vitest";
import { textoDiagnostico } from "../../../src/main/sistema/diagnostico";

const base = {
  version: "0.2.0", electron: "35.1.0", windows: "10.0.26300", cpu: "AMD Ryzen 5 5600H", ramGb: 16, gpu: "NVIDIA GeForce RTX 3050",
  estado: {
    ffmpeg: { ok: false, detalle: "FFmpeg no está instalado.", accion: "instalar-ffmpeg" as const },
    python: { ok: true, detalle: "Python y modelos listos" },
    gpu: { ok: true, detalle: "GPU NVIDIA lista" },
    claude: { ok: true, detalle: "No revisado" },
  },
  lineas: Array.from({ length: 200 }, (_, i) => `linea ${i + 1}`),
};

test("el diagnóstico trae la versión, el sistema, los chequeos y el registro en orden", () => {
  const t = textoDiagnostico(base);
  expect(t).toContain("Reels Iglesia 0.2.0");
  expect(t).toContain("Windows 10.0.26300");
  expect(t).toContain("Electron 35.1.0");
  expect(t).toContain("AMD Ryzen 5 5600H");
  expect(t).toContain("16 GB");
  expect(t).toContain("✘ FFmpeg no está instalado.");
  expect(t).toContain("✔ Python y modelos listos");
  expect(t).toContain("Registro (últimas 200 líneas)");
  expect(t.indexOf("linea 1\n")).toBeLessThan(t.indexOf("linea 200"));
});

test("sin registro lo dice", () => {
  expect(textoDiagnostico({ ...base, lineas: [] })).toContain("(el registro está vacío)");
});
