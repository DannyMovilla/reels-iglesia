import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { analizarReferencia, medirReferencia } from "../../src/main/estilo/referencia";
import type { ClipSpec } from "../../src/shared/tipos";
import { PLAN3 } from "../ayuda/plan3";

const dir = mkdtempSync(join(tmpdir(), "reels-ref-"));
const video = (nombre: string, args: string[]) => {
  const ruta = join(dir, nombre);
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args, "-pix_fmt", "yuv420p", ruta]);
  return ruta;
};

test("un video vertical sin audio: cuadros y cortes sí, volumen no (con aviso)", async () => {
  // Tres colores seguidos: dos cortes en 6 s.
  const v = video("vertical.mp4", [
    "-f", "lavfi", "-i", "color=c=red:s=360x640:d=2", "-f", "lavfi", "-i", "color=c=blue:s=360x640:d=2", "-f", "lavfi", "-i", "color=c=green:s=360x640:d=2",
    "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0",
  ]);
  const m = await medirReferencia(v, join(dir, "c1"));
  expect(m.duracion).toBeCloseTo(6, 0);
  expect(m.cuadros.length).toBeGreaterThanOrEqual(5);
  expect(m.cortesPorMinuto).toBeGreaterThanOrEqual(10);
  expect(m.lufs).toBeNull();
  expect(m.avisos).toContain("El video no tiene audio: no pude medir el volumen.");
}, 60_000);

test("un video horizontal de 2 s con audio: avisa que no midió el ritmo, pero mide el volumen", async () => {
  const v = video("corto.mp4", ["-f", "lavfi", "-i", "testsrc2=s=640x360:d=2", "-f", "lavfi", "-i", "sine=f=440:d=2", "-shortest"]);
  const m = await medirReferencia(v, join(dir, "c2"));
  expect(m.cortesPorMinuto).toBeNull();
  expect(m.lufs).not.toBeNull();
  expect(m.avisos[0]).toMatch(/menos de 3 segundos/);
}, 60_000);

test("analizarReferencia con el Claude falso: le da permiso de leer los cuadros y devuelve el estilo", async () => {
  const v = video("ref.mp4", ["-f", "lavfi", "-i", "testsrc2=s=360x640:d=5", "-f", "lavfi", "-i", "sine=f=330:d=5", "-shortest"]);
  const clip: ClipSpec = {
    id: "c", titulo: "T", gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 10, fin: 50, apertura: null, palabrasClave: [],
    versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
    subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3, cierre: true, formatos: ["9:16"], estado: "sugerido",
  };
  const r = await analizarReferencia(v, clip, { comando: `node ${join(resolve(__dirname, "../fixtures"), "claude/falso-claude.mjs")}` });
  expect(r.estilo).toMatchObject({ subtitulos: "karaoke", tamano: "l", look: "cine", intensidad: "fuerte", fuenteSubtitulos: "montserrat" });
  expect(r.estilo.explicacion).toMatch(/^Miré \d cuadros\.$/);
}, 60_000);
