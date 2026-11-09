// @vitest-environment jsdom
import { expect, test } from "vitest";
import { describe } from "vitest";
import { detectarRepeticiones, tramosDelClip } from "../../../src/shared/reel/cortes-voz";
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

describe("plan 5: intensidad, lista, quitados y repeticiones", () => {
  /** Habla 0–2 s, pausa de 0,6 s, habla 2,6–4 s, pausa de 0,9 s, habla 4,9–6 s. */
  const ps: Palabra[] = [w(0, 1, "Dios"), w(1.1, 2, "es"), w(2.6, 4, "fiel"), w(4.9, 6, "siempre.")];
  const base = (cortes: ClipSpec["cortes"]) => clip({ inicio: 0, fin: 6, cortes });

  test("Normal (sin intensidad, como los clips viejos) corta solo la pausa de 0,9 s y deja 0,25 s", () => {
    const t = tramosDelClip(base({ pausas: true, muletillas: false }), ps);
    expect(t).toEqual([{ inicio: 0, fin: 4.125 }, { inicio: 4.775, fin: 6 }]);
  });

  test("Suave no corta pausas de menos de 1 s", () => {
    expect(tramosDelClip(base({ pausas: true, muletillas: false, intensidad: "suave" }), ps)).toEqual([{ inicio: 0, fin: 6 }]);
  });

  test("Fuerte corta las pausas de más de 0,45 s y deja 0,16 s", () => {
    const t = tramosDelClip(base({ pausas: true, muletillas: false, intensidad: "fuerte" }), ps);
    expect(t).toEqual([{ inicio: 0, fin: 2.08 }, { inicio: 2.52, fin: 4.08 }, { inicio: 4.82, fin: 6 }]);
  });

  test("la lista propia reemplaza a la de por defecto", () => {
    const t = tramosDelClip(clip({ cortes: { pausas: false, muletillas: true, lista: ["amor"] } }), palabras);
    // "amor" (19,1–20, suelto) se quita; los "eh" se quedan.
    expect(t.some((x) => x.inicio <= 16.5 && x.fin >= 16.7)).toBe(true);
    expect(t.some((x) => x.inicio <= 19.5 && x.fin >= 19.5)).toBe(false);
  });

  test("tramos quitados que cruzan el inicio, el fin y una pausa ya cortada: sin superponerse ni pedazos diminutos", () => {
    const quitados = [{ inicio: -1, fin: 0.5 }, { inicio: 3.9, fin: 5 }, { inicio: 5.98, fin: 9 }];
    const t = tramosDelClip(base({ pausas: true, muletillas: false, quitados }), ps);
    for (const x of t) expect(x.fin - x.inicio).toBeGreaterThanOrEqual(0.05);
    for (let i = 1; i < t.length; i++) expect(t[i].inicio).toBeGreaterThanOrEqual(t[i - 1].fin);
    expect(t[0].inicio).toBe(0.5);
    expect(t.at(-1)!.fin).toBeLessThanOrEqual(5.98);
    for (const q of quitados) for (const x of t) expect(x.fin <= q.inicio || x.inicio >= q.fin).toBe(true);
  });

  test("quitados sin pausas ni muletillas también se aplican", () => {
    expect(tramosDelClip(base({ pausas: false, muletillas: false, quitados: [{ inicio: 1, fin: 2.6 }] }), ps))
      .toEqual([{ inicio: 0, fin: 1 }, { inicio: 2.6, fin: 6 }]);
  });
});

describe("detectarRepeticiones", () => {
  const frase = (desde: number, textos: string[]) => textos.map((t, i) => w(desde + i * 0.4, desde + i * 0.4 + 0.35, t));

  test("la misma frase de 3 palabras dentro de 8 s: se sugiere quitar la primera toma", () => {
    const ps = [...frase(0, ["Y", "Dios", "te"]), ...frase(1.5, ["y", "Dios", "te", "ama."])];
    const r = detectarRepeticiones(ps, 0, 10);
    expect(r).toEqual([{ inicio: 0, fin: 1.5, texto: "Y Dios te" }]);
  });

  test("la misma frase a 12 s no es una repetición", () => {
    const ps = [...frase(0, ["Y", "Dios", "te"]), ...frase(12, ["y", "Dios", "te", "ama."])];
    expect(detectarRepeticiones(ps, 0, 20)).toEqual([]);
  });

  test("una primera toma de más de 12 palabras no se sugiere", () => {
    const larga = ["y", "Dios", "te", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
    const ps = [...frase(0, larga), ...frase(6.2, ["y", "Dios", "te"])];
    expect(detectarRepeticiones(ps, 0, 20)).toEqual([]);
  });
});
