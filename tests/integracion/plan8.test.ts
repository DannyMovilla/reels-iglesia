import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { prepararCarpeta } from "../../src/main/exportar/preparar";
import { renderizar } from "../../src/main/exportar/render";
import { construirComposicion } from "../../src/shared/reel/composicion";
import type { EstiloGancho } from "../../src/shared/reel/gancho";
import type { ClipSpec, EstiloSub, Formato, Transcripcion } from "../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3, SIN_MUSICA } from "../ayuda/plan3";

/**
 * Cuánto se aleja del gris del video, píxel por píxel (promedio de la mayor diferencia de canal) en un rectángulo
 * del cuadro del segundo t. El texto blanco con borde negro promedia gris: por eso se mide cada píxel.
 */
function desvio(mp4: string, t: number, x: number, y: number, w: number, h: number): number {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", mp4, "-frames:v", "1", "-vf", `crop=${w}:${h}:${x}:${y}`, "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]);
  let s = 0;
  for (let i = 0; i + 2 < raw.length; i += 3) s += Math.max(Math.abs(raw[i] - 128), Math.abs(raw[i + 1] - 128), Math.abs(raw[i + 2] - 128));
  return s / (raw.length / 3);
}
const duracion = (mp4: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4], { encoding: "utf8" }));
const topDe = (html: string, id: string) => Number(new RegExp(`id="${id}"[^>]*style="top:([\\d.]+)px`).exec(html)![1]);

let video = "";
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "reels-p8-v-"));
  video = join(dir, "gris.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=1280x720:d=4:r=30", "-f", "lavfi", "-i", "sine=f=220:d=4", "-shortest", "-pix_fmt", "yuv420p", video]);
});

const t: Transcripcion = { formato: "pulpito-transcripcion/1", inicio: 0, fin: 4, modelo: "m", dispositivo: "cpu",
  segmentos: [{ s: 0.2, e: 2.4, t: "Dios es fiel", w: [[0.2, 0.9, "Dios"], [1.0, 1.6, "es"], [1.7, 2.4, "fiel"]] }] };

async function render(c: Partial<ClipSpec>, formato: Formato = "9:16") {
  const clip: ClipSpec = {
    id: "c", titulo: "T", gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 0.2, fin: 2.4, apertura: null, palabrasClave: ["fiel"],
    versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "fijo", x: 0.5, zoom: 1 },
    subtitulos: { activos: false, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3, musica: SIN_MUSICA, cierre: false, formatos: [formato], estado: "sugerido",
    efectos: { ...PLAN3.efectos, rotulo: false, sonidos: false }, ...c,
  };
  const comp = construirComposicion({ clip, transcripcion: t, caras: null, formato, dimensiones: { ancho: 1280, alto: 720 },
    marca: { nombre: "Iglesia", color: "#2f6bff", invitacion: "", ...MARCA_PLAN3 },
    fuenteVideo: video.replace(/\\/g, "/"), recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes" }, modo: "render" });
  const dir = mkdtempSync(join(tmpdir(), "reels-p8-"));
  await prepararCarpeta(dir, comp.html);
  const salida = join(dir, "reel.mp4");
  await renderizar(dir, salida, { gpu: true, senal: new AbortController().signal, alProgreso: () => {} });
  return { salida, html: comp.html };
}

describe("plan 8: los 8 estilos de subtítulo nuevos se pintan en el video", () => {
  test.each(["viral", "una", "cajamarca", "subrayado", "dostonos", "rebote", "brillo", "elegante"] as EstiloSub[])("%s", async (estilo) => {
    const { salida, html } = await render({ subtitulos: { activos: true, estilo, tamano: "m", altura: 0.74 } });
    expect(duracion(salida)).toBeCloseTo(2.2, 0);
    const top = topDe(html, "b0");
    expect(desvio(salida, 2.0, 60, Math.round(top - 50), 960, 100)).toBeGreaterThan(12);
  }, 300_000);
});

describe("plan 8: los ganchos nuevos se pintan en el video", () => {
  test.each([["gigante", "9:16"], ["marca", "9:16"], ["subrayado", "9:16"], ["golpe", "9:16"], ["gigante", "1:1"]] as [EstiloGancho, Formato][])("%s en %s", async (estiloGancho, formato) => {
    const { salida, html } = await render({ gancho: "Dios es fiel siempre", estiloGancho }, formato);
    const top = topDe(html, "gancho");
    if (estiloGancho === "gigante" && formato === "9:16") execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-i", salida, "-frames:v", "1", join(__dirname, "../../.superpowers/sdd/2026-11-09-reels-iglesia-plan-8-subtitulos-gancho-frases/gancho-gigante.png")]);
    expect(desvio(salida, 1.0, 60, Math.round(top - 60), 960, 120)).toBeGreaterThan(12);
  }, 300_000);
});
