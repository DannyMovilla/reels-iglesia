import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { prepararCarpeta } from "../../src/main/exportar/preparar";
import { renderizar } from "../../src/main/exportar/render";
import { construirComposicion } from "../../src/shared/reel/composicion";
import { construirReelVersiculo } from "../../src/shared/reel/versiculo-reel";
import type { ClipSpec, Creacion, Transcripcion } from "../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3, SIN_MUSICA } from "../ayuda/plan3";

const RAIZ = resolve(__dirname, "../..");
const marca = { nombre: "Iglesia Familia", color: "#f2b544", invitacion: "Síguenos", ...MARCA_PLAN3 };

/** Saturación media (0–255, máximo menos mínimo de R, G, B) del cuadro en el segundo t. */
function saturacionErr(mp4: string, t: number): number {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", mp4, "-frames:v", "1", "-vf", "scale=54:96", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]);
  let suma = 0;
  for (let i = 0; i + 2 < raw.length; i += 3) suma += Math.max(raw[i], raw[i + 1], raw[i + 2]) - Math.min(raw[i], raw[i + 1], raw[i + 2]);
  return suma / (raw.length / 3);
}
/** Brillo medio (0–255) y desviación (detalle) del cuadro en el segundo t. */
function brillo(mp4: string, t: number): { media: number; detalle: number } {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", mp4, "-frames:v", "1", "-vf", "scale=54:96,format=gray", "-f", "rawvideo", "-"]);
  const media = raw.reduce((a, b) => a + b, 0) / raw.length;
  return { media, detalle: Math.sqrt(raw.reduce((a, b) => a + (b - media) ** 2, 0) / raw.length) };
}

test("el look «B/N suave» llega al MP4 (el filtro de color se ve en el render, no solo en la vista previa)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reels-p6c-"));
  const video = join(dir, "colores.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:d=8:r=30", "-f", "lavfi", "-i", "sine=f=220:d=8", "-shortest", "-pix_fmt", "yuv420p", video]);
  const t: Transcripcion = { formato: "pulpito-transcripcion/1", inicio: 0, fin: 8, modelo: "m", dispositivo: "cpu",
    segmentos: [{ s: 0.2, e: 7.8, t: "Dios es fiel siempre", w: [[0.2, 2, "Dios"], [2.1, 4, "es"], [4.1, 6, "fiel"], [6.1, 7.8, "siempre"]] }] };
  const clip = (color?: ClipSpec["color"]): ClipSpec => ({
    id: "c", titulo: "T", gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 0.2, fin: 7.8, apertura: null, palabrasClave: [],
    versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "fijo", x: 0.5, zoom: 1 },
    subtitulos: { activos: false, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3, musica: SIN_MUSICA, cierre: false, formatos: ["9:16"], estado: "sugerido",
    ...(color ? { color } : {}),
  });
  const render = async (c: ClipSpec, nombre: string) => {
    const d = join(dir, nombre);
    const comp = construirComposicion({ clip: c, transcripcion: t, caras: null, formato: "9:16", dimensiones: { ancho: 1280, alto: 720 }, marca: { ...marca, nombre: "" },
      fuenteVideo: video.replace(/\\/g, "/"), recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes" }, modo: "render" });
    await prepararCarpeta(d, comp.html);
    const salida = join(d, "reel.mp4");
    await renderizar(d, salida, { gpu: true, senal: new AbortController().signal, alProgreso: () => {} });
    return salida;
  };
  const normal = await render(clip(), "normal");
  const bn = await render(clip({ look: "bn", intensidad: 1 }), "bn");
  const sNormal = saturacionErr(normal, 3), sBn = saturacionErr(bn, 3);
  expect(sNormal).toBeGreaterThan(20);
  expect(sBn).toBeLessThan(sNormal / 4);
}, 400_000);

test("reel de versículo con una pintura clásica: se ve la pintura (no negro, con detalle)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reels-p6p-"));
  const c: Creacion = {
    id: "c", creado: "", entrada: { tipo: "versiculo", texto: "Lucas 15:20" },
    versiculo: { ref: "Lucas 15:20", texto: "Y levantándose, vino a su padre.", confirmado: true },
    gancho: "Siempre puedes volver", reflexion: "", palabrasClave: [],
    musica: { modo: "ninguna", pista: null, animo: "esperanza", tonalidad: "Re", volumen: 0.18 }, subtitulos: { estilo: "pop" }, fondo: { tipo: "pintura", pintura: "prodigo" },
    redes: { instagram: { texto: "", hashtags: [] }, tiktok: { texto: "", hashtags: [] }, facebook: { texto: "" }, youtube: { titulo: "", texto: "" } },
    formatos: ["9:16"], estado: "borrador",
  };
  const comp = construirReelVersiculo({ creacion: c, marca, formato: "9:16", modo: "render",
    recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", pinturas: "recursos/pinturas" } });
  await prepararCarpeta(dir, comp.html, { "recursos/pinturas/prodigo.jpg": join(RAIZ, "resources", "pinturas", "prodigo.jpg") });
  const salida = join(dir, "reel.mp4");
  await renderizar(dir, salida, { gpu: true, senal: new AbortController().signal, alProgreso: () => {} });
  const b = brillo(salida, 1.5);
  expect(b.media).toBeGreaterThan(8);
  expect(b.detalle).toBeGreaterThan(5);
}, 400_000);
