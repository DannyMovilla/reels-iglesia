import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { prepararCarpeta } from "../../../src/main/exportar/preparar";
import { progresoHyperframes, renderizar } from "../../../src/main/exportar/render";
import type { OpcionesProceso, ResultadoProceso } from "../../../src/main/procesos/lineas";

test("lee el progreso de las líneas @hf-progress", () => {
  expect(progresoHyperframes('@hf-progress {"code":"capture","done":10,"total":40,"pct":25}')).toBe(25);
  expect(progresoHyperframes("Render complete")).toBeNull();
  expect(progresoHyperframes("@hf-progress {roto")).toBeNull();
});

function falso() {
  const llamadas: { cmd: string; args: string[]; op?: OpcionesProceso }[] = [];
  const ejecutar = async (cmd: string, args: string[], op?: OpcionesProceso): Promise<ResultadoProceso> => {
    llamadas.push({ cmd, args, op });
    op?.alLinea?.('@hf-progress {"pct":40}');
    return { codigo: 0, stdout: "", stderr: "" };
  };
  return { llamadas, ejecutar };
}

test("renderiza con 4 workers, 10M y --gpu solo si hay GPU, reportando el progreso", async () => {
  const f = falso();
  const progresos: number[] = [];
  await renderizar("C:/tmp/r", "C:/salida/a.mp4", { gpu: true, senal: new AbortController().signal, alProgreso: (p) => progresos.push(p), ejecutar: f.ejecutar });
  const a = f.llamadas[0].args;
  expect(a.slice(1)).toEqual(["render", "--workers", "4", "--video-bitrate", "10M", "-o", "C:/salida/a.mp4", "--gpu"]);
  expect(a[0]).toMatch(/hyperframes[\\/]bin[\\/]hyperframes\.mjs$/);
  expect(f.llamadas[0].op?.cwd).toBe("C:/tmp/r");
  expect(f.llamadas[0].op?.env?.ELECTRON_RUN_AS_NODE).toBe("1");
  expect(progresos).toEqual([40]);

  const g = falso();
  await renderizar("C:/tmp/r", "C:/salida/a.mp4", { gpu: false, senal: new AbortController().signal, alProgreso: () => {}, ejecutar: g.ejecutar });
  expect(g.llamadas[0].args).not.toContain("--gpu");
});

test("si el render falla, el error está en español con las últimas líneas", async () => {
  const ejecutar = async (): Promise<ResultadoProceso> => ({ codigo: 1, stdout: "", stderr: "a\nb\nError: no se pudo leer el video" });
  await expect(renderizar("d", "s.mp4", { gpu: false, senal: new AbortController().signal, alProgreso: () => {}, ejecutar }))
    .rejects.toThrow(/^No se pudo exportar el reel\.[\s\S]*no se pudo leer el video/);
});

test("prepararCarpeta deja index.html, GSAP y las fuentes locales", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reels-prep-"));
  await prepararCarpeta(dir, "<html>hola</html>");
  expect(readFileSync(join(dir, "index.html"), "utf8")).toBe("<html>hola</html>");
  for (const f of ["recursos/gsap.min.js", "recursos/fuentes/montserrat/files/montserrat-latin-900-normal.woff2",
    "recursos/fuentes/figtree/files/figtree-latin-800-normal.woff2", "hyperframes.json", "meta.json"]) {
    expect(existsSync(join(dir, f)), f).toBe(true);
  }
});
