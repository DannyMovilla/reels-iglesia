import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { prepararCarpeta } from "../../src/main/exportar/preparar";
import { renderizar } from "../../src/main/exportar/render";
import { construirComposicion } from "../../src/shared/reel/composicion";
import type { ClipSpec, Transcripcion } from "../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3, SIN_MUSICA } from "../ayuda/plan3";

/** Color promedio (R, G, B) de un rectángulo del cuadro en el segundo t. */
function color(mp4: string, t: number, x: number, y: number, w: number, h: number): [number, number, number] {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", mp4, "-frames:v", "1", "-vf", `crop=${w}:${h}:${x}:${y}`, "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]);
  const s = [0, 0, 0];
  for (let i = 0; i + 2 < raw.length; i += 3) for (let c = 0; c < 3; c++) s[c] += raw[i + c];
  return s.map((v) => v / (raw.length / 3)) as [number, number, number];
}

test("el logo de la iglesia sale abajo durante el reel cuando se elige «Logo»", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reels-p7-"));
  const video = join(dir, "gris.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=1280x720:d=6:r=30", "-f", "lavfi", "-i", "sine=f=220:d=6", "-shortest", "-pix_fmt", "yuv420p", video]);
  const logo = join(dir, "logo.png");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=200x200:d=1", "-frames:v", "1", logo]);
  const t: Transcripcion = { formato: "pulpito-transcripcion/1", inicio: 0, fin: 6, modelo: "m", dispositivo: "cpu",
    segmentos: [{ s: 0.2, e: 5.8, t: "Dios es fiel", w: [[0.2, 2, "Dios"], [2.1, 4, "es"], [4.1, 5.8, "fiel"]] }] };
  const clip: ClipSpec = {
    id: "c", titulo: "T", gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 0.2, fin: 5.8, apertura: null, palabrasClave: [],
    versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "fijo", x: 0.5, zoom: 1 },
    subtitulos: { activos: false, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3, musica: SIN_MUSICA, cierre: false, formatos: ["9:16"], estado: "sugerido",
  };
  const comp = construirComposicion({ clip, transcripcion: t, caras: null, formato: "9:16", dimensiones: { ancho: 1280, alto: 720 },
    marca: { nombre: "Iglesia", color: "#f2b544", invitacion: "", ...MARCA_PLAN3, logo, marcaReel: { modo: "logo", tamano: 1 } },
    fuenteVideo: video.replace(/\\/g, "/"), recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", logo: "recursos/logo.png" }, modo: "render" });
  await prepararCarpeta(dir, comp.html);
  copyFileSync(logo, join(dir, "recursos", "logo.png"));
  const salida = join(dir, "reel.mp4");
  await renderizar(dir, salida, { gpu: true, senal: new AbortController().signal, alProgreso: () => {} });
  // Logo de 90 px de alto, centrado, con el borde de abajo a 70 px del final.
  const [r, g, b] = color(salida, 3, 520, 1920 - 70 - 70, 40, 40);
  expect(r).toBeGreaterThan(150);
  expect(g).toBeLessThan(90);
  expect(b).toBeLessThan(90);
}, 300_000);
