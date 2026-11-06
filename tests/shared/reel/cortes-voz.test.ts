// @vitest-environment jsdom
import { expect, test } from "vitest";
import { tramosDelClip } from "../../../src/shared/reel/cortes-voz";
import { construirComposicion } from "../../../src/shared/reel/composicion";
import { bloquesSubtitulos } from "../../../src/shared/reel/subtitulos";
import { duracionReel, partesDelReel, reelAVideo, videoAReel, type Palabra } from "../../../src/shared/reel/tiempo";
import { ventanaVersiculo } from "../../../src/shared/reel/versiculo";
import type { ClipSpec, Transcripcion } from "../../../src/shared/tipos";
import { MARCA_PLAN3, PLAN3 } from "../../ayuda/plan3";

const w = (s: number, e: number, t: string): Palabra => ({ s, e, t });
/** Habla de 5 a 10 s, pausa de 1,5 s, habla de 11,5 a 16 s, "eh" suelto, y sigue. */
const palabras: Palabra[] = [
  w(5, 6, "Hermanos,"), w(6.1, 7, "Dios"), w(7.1, 8, "nos"), w(8.1, 10, "ama."),
  w(11.5, 12.5, "Él"), w(12.6, 13.5, "siempre"), w(13.6, 16, "responde."),
  w(16.4, 16.7, "eh"), w(17, 18, "y"), w(18.1, 19, "este"), w(19.1, 20, "amor"),
  w(20.3, 20.6, "Eh…"), w(20.62, 21.5, "Dios"), w(21.6, 23, "permanece."),
];
const clip = (extra: Partial<ClipSpec> = {}): ClipSpec => ({
  id: "c", titulo: "T", gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 5, fin: 23,
  apertura: null, palabrasClave: [], versiculos: [], puntaje: 90, razon: "", descripcion: "", hashtags: [],
  encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
  ...PLAN3, cortes: { pausas: true, muletillas: true }, cierre: false, formatos: ["9:16"], estado: "sugerido", ...extra,
});

test("una pausa de 1,5 s se acorta a 0,25 s", () => {
  const t = tramosDelClip(clip({ cortes: { pausas: true, muletillas: false } }), palabras);
  expect(t[0]).toEqual({ inicio: 5, fin: 10.125 });
  expect(t[1].inicio).toBe(11.375);
});

test("el 'eh' suelto se quita; el pegado a la palabra siguiente y 'este' no", () => {
  const t = tramosDelClip(clip({ cortes: { pausas: false, muletillas: true } }), palabras);
  expect(t).toEqual([{ inicio: 5, fin: 16.125 }, { inicio: 16.875, fin: 23 }]);
});

test("sin cortes: un solo tramo igual al clip", () => {
  expect(tramosDelClip(clip({ cortes: { pausas: false, muletillas: false } }), palabras)).toEqual([{ inicio: 5, fin: 23 }]);
});

test("el reel dura exactamente lo que queda y los tiempos se traducen en ambos sentidos", () => {
  const c = clip();
  const tramos = tramosDelClip(c, palabras);
  const quedan = tramos.reduce((a, x) => a + (x.fin - x.inicio), 0);
  expect(duracionReel(c, palabras)).toBeCloseTo(quedan, 2);
  const parte = partesDelReel(c, palabras).find((p) => p.tipo === "clip")!;
  expect(videoAReel(parte, 12)).toBeCloseTo(10.125 - 5 + (12 - 11.375), 2);
  expect(videoAReel(parte, 11)).toBeNull(); // dentro de la pausa quitada
  expect(reelAVideo(parte, videoAReel(parte, 19)!)).toBeCloseTo(19, 2);
});

test("versículo citado en un tramo quitado: la tarjeta empieza al volver la voz y no hay subtítulos encima", () => {
  const c = clip({ versiculos: [{ ref: "Juan 3:16", texto: "Porque de tal manera amó Dios al mundo", en: 5.8, activo: true, confirmado: true }] }); // 5 + 5,8 = 10,8: pausa
  const partes = partesDelReel(c, palabras);
  const parte = partes.find((p) => p.tipo === "clip")!;
  const v = ventanaVersiculo(c.versiculos[0], parte)!;
  expect(v.desde).toBeCloseTo(videoAReel(parte, 11.375)!, 2);
  const bloques = bloquesSubtitulos(c, palabras, partes);
  expect(bloques.some((b) => b.desde < v.hasta && b.hasta > v.desde && b.desde >= v.desde)).toBe(false);
});

test("la composición tiene un video y una voz por tramo con su segundo del original", () => {
  const t: Transcripcion = { formato: "pulpito-transcripcion/1", inicio: 0, fin: 30, modelo: "", dispositivo: "", segmentos: [{ s: 5, e: 23, t: "", w: palabras.map((p) => [p.s, p.e, p.t] as [number, number, string]) }] };
  const c = clip();
  const r = construirComposicion({ clip: c, transcripcion: t, caras: null, formato: "9:16", dimensiones: { ancho: 1280, alto: 720 },
    marca: { nombre: "I", color: "#fff", invitacion: "", ...MARCA_PLAN3 }, fuenteVideo: "v.mp4", recursos: { gsap: "g", fuentes: "f" }, modo: "render",
    voz: { src: "voz.m4a", inicioRango: 0 } });
  const d = new DOMParser().parseFromString(r.html, "text/html");
  const tramos = tramosDelClip(c, palabras);
  expect([...d.querySelectorAll("video")].map((x) => Number(x.getAttribute("data-media-start")))).toEqual(tramos.map((x) => Math.round(x.inicio * 100) / 100));
  expect(d.querySelectorAll("audio.voz")).toHaveLength(tramos.length);
  expect(r.duracion).toBeCloseTo(duracionReel(c, palabras), 2);
});

test("revisión I1: con tiempos pegados (como los da Whisper) no queda nada del «eh» en la voz", () => {
  const ws: Palabra[] = [w(0.5, 1.0, "Dios"), w(1.0, 1.5, "eh"), w(1.7, 2.5, "responde"), w(2.6, 3, "hoy")];
  const t = tramosDelClip(clip({ inicio: 0.5, fin: 3, cortes: { pausas: false, muletillas: true } }), ws);
  expect(t[0].fin).toBeLessThanOrEqual(1.0);
  expect(t[1].inicio).toBeGreaterThanOrEqual(1.5);
});

test("menor: un «eh» al inicio o al final del clip también se quita, y el silencio de los bordes se acorta", () => {
  const ws: Palabra[] = [w(10.4, 10.7, "eh"), w(11, 12, "Dios"), w(12.1, 13, "es"), w(13.1, 14, "fiel."), w(14.3, 14.6, "mmm")];
  const t = tramosDelClip(clip({ inicio: 9, fin: 16, cortes: { pausas: true, muletillas: true } }), ws);
  expect(t[0].inicio).toBeCloseTo(10.875, 3); // sin el silencio ni el «eh» del inicio
  expect(t.at(-1)!.fin).toBeCloseTo(14.125, 3); // sin el «mmm» ni el silencio del final
});
