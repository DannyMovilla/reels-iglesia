import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { ajustarCorte } from "../../../src/shared/reel/cortes";
import { pistaCamara, posicionGancho } from "../../../src/shared/reel/encuadre";
import { aplicarReglaVersiculo, bloquesSubtitulos } from "../../../src/shared/reel/subtitulos";
import { duracionReel, palabrasDe, partesDelReel } from "../../../src/shared/reel/tiempo";
import { duracionLectura, ventanaVersiculo } from "../../../src/shared/reel/versiculo";
import type { Caras, ClipSpec, Transcripcion } from "../../../src/shared/tipos";
import { PLAN3 } from "../../ayuda/plan3";

const muestra: Transcripcion = JSON.parse(readFileSync(join(resolve(__dirname, "../../fixtures"), "transcripcion-muestra.json"), "utf8"));
const palabras = palabrasDe(muestra);

const clip = (extra: Partial<ClipSpec> = {}): ClipSpec => ({
  id: "c", titulo: "T", gancho: "G", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46,
  apertura: { activa: true, inicio: 39.02, fin: 44.8, frase: "ese quebrantamiento" }, palabrasClave: ["quebrantamiento"],
  versiculos: [], puntaje: 90, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3,
  cierre: true, formatos: ["9:16"], estado: "sugerido", ...extra,
});

describe("tiempo", () => {
  test("partes: apertura + clip + cierre con tiempos de reel", () => {
    const p = partesDelReel(clip());
    expect(p.map((x) => x.tipo)).toEqual(["apertura", "clip", "cierre"]);
    expect(p.map((x) => x.duracion)).toEqual([5.78, 32.53, 2.6]);
    expect(p.map((x) => x.inicioReel)).toEqual([0, 5.78, 38.31]);
    expect(duracionReel(clip())).toBe(40.91);
  });

  test("sin apertura ni cierre solo queda el clip", () => {
    const p = partesDelReel(clip({ apertura: { activa: false, inicio: 39.02, fin: 44.8, frase: "" }, cierre: false }));
    expect(p.map((x) => [x.tipo, x.inicioReel, x.duracion])).toEqual([["clip", 0, 32.53]]);
  });
});

describe("cortes", () => {
  test("ajusta inicio y fin a límites de palabra", () => {
    expect(ajustarCorte({ inicio: 31.0, fin: 63.6 }, palabras)).toEqual({ inicio: 30.93, fin: 63.46 });
  });

  test("un corte de menos de 5 s se extiende hasta la primera palabra que alcanza 5 s", () => {
    const r = ajustarCorte({ inicio: 61.72, fin: 62.0 }, palabras);
    expect(r.inicio).toBe(61.72);
    expect(r.fin - r.inicio).toBeGreaterThanOrEqual(5);
    const anterior = palabras.filter((w) => w.e < r.fin).at(-1)!;
    expect(anterior.e - r.inicio).toBeLessThan(5);
    expect(palabras.some((w) => w.e === r.fin)).toBe(true);
  });
});

describe("versículo", () => {
  test("duración de lectura entre 4 y 8 s", () => {
    expect(duracionLectura(Array(22).fill("palabra").join(" "))).toBe(7.1);
    expect(duracionLectura("tres palabras aquí")).toBe(4);
    expect(duracionLectura(Array(40).fill("x").join(" "))).toBe(8);
  });

  test("la tarjeta nunca se sale del clip ni entra al cierre", () => {
    const partes = partesDelReel(clip());
    const c = partes[1];
    const texto = Array(22).fill("p").join(" ");
    const tarde = ventanaVersiculo({ ref: "Salmos 51:17", texto, en: 31, activo: true, confirmado: true }, c)!;
    expect(tarde.hasta).toBe(38.31);
    expect(tarde.desde).toBeCloseTo(38.31 - 7.1, 5);
    const temprano = ventanaVersiculo({ ref: "Salmos 51:17", texto, en: 0, activo: true, confirmado: true }, c)!;
    expect(temprano.desde).toBe(5.78);
    expect(ventanaVersiculo({ ref: "x", texto, en: 3, activo: false, confirmado: true }, c)).toBeNull();
  });
});

describe("subtítulos", () => {
  test("regla del versículo: se corta el bloque que entra y se omite el que quedaría muy corto", () => {
    const b = (desde: number, hasta: number) => ({ desde, hasta, palabras: [] });
    const r = aplicarReglaVersiculo([b(16.0, 17.0), b(16.4, 17.0), b(18, 19), b(25, 26)], [{ desde: 16.5, hasta: 24 }]);
    expect(r.map((x) => [x.desde, x.hasta])).toEqual([[16.0, 16.5], [25, 26]]);
  });

  test("bloques pop: máx. 3 palabras / 16 caracteres, en tiempo de reel, palabras clave marcadas", () => {
    const c = clip();
    const bloques = bloquesSubtitulos(c, palabras, partesDelReel(c));
    expect(bloques.length).toBeGreaterThan(10);
    for (const x of bloques) {
      expect(x.palabras.length).toBeLessThanOrEqual(3);
      expect(x.desde).toBeGreaterThanOrEqual(0);
      expect(x.hasta).toBeLessThanOrEqual(38.31 + 0.01);
    }
    expect(bloques.some((x) => x.palabras.some((p) => p.clave && /quebrantamiento/i.test(p.texto)))).toBe(true);
    // la apertura (0–5,78) también lleva subtítulos
    expect(bloques[0].desde).toBeLessThan(1);
  });

  test("con un versículo activo no hay subtítulos dentro de su ventana", () => {
    const texto = Array(10).fill("p").join(" ");
    const c = clip({ versiculos: [{ ref: "Salmos 51:17", texto, en: 10, activo: true, confirmado: true }] });
    const partes = partesDelReel(c);
    const v = ventanaVersiculo(c.versiculos[0], partes[1])!;
    for (const x of bloquesSubtitulos(c, palabras, partes)) expect(x.desde >= v.hasta || x.hasta <= v.desde).toBe(true);
  });
});

describe("encuadre", () => {
  test("cambio de cámara = corte seco; oscilaciones pequeñas no mueven la cámara", () => {
    const caras: Caras = [];
    for (let i = 0; i < 40; i++) {
      const t = i * 0.5;
      const x = t < 10 ? 0.5 + (i % 2 ? 0.02 : -0.02) : 0.8;
      caras.push([t, [[x, 0.3, 0.06, 0.9]]]);
    }
    const p = pistaCamara(caras, 0, 20)!;
    const antes = p.keys.filter((k) => k.t < 9.9).map((k) => k.x);
    expect(Math.max(...antes) - Math.min(...antes)).toBeLessThan(0.03);
    const corte = p.keys.findIndex((k, i) => i > 0 && k.t - p.keys[i - 1].t <= 0.021 && Math.abs(k.x - p.keys[i - 1].x) > 0.15);
    expect(corte).toBeGreaterThan(0);
    expect(p.keys[corte].t).toBeCloseTo(10, 1);
  });

  test("el gancho va en la franja libre más grande, nunca sobre la cabeza (posiciones en el cuadro de salida)", () => {
    // El cartel (medio alto m) no se cruza con la cabeza: del pelo (0,9 alto sobre el centro) al mentón (0,7 bajo el centro).
    const tapa = (g: number, cara: { centro: number; alto: number }, m: number) => g + m > cara.centro - cara.alto * 0.9 && g - m < cara.centro + cara.alto * 0.7;
    const arriba = { centro: 0.25, alto: 0.12 };
    expect(posicionGancho(arriba, "9:16")).toBeGreaterThan(arriba.centro); // cara arriba → debajo
    expect(tapa(posicionGancho(arriba, "9:16"), arriba, 0.055)).toBe(false);
    const media = { centro: 0.45, alto: 0.18 }; // zoom 1: la cara llega a la mitad
    expect(posicionGancho(media, "9:16")).toBeLessThan(media.centro);
    expect(tapa(posicionGancho(media, "9:16"), media, 0.055)).toBe(false);
    const abajo = { centro: 0.6, alto: 0.12 };
    expect(posicionGancho(abajo, "4:5")).toBeLessThan(abajo.centro);
    expect(tapa(posicionGancho(abajo, "4:5"), abajo, 0.075)).toBe(false);
    const cuadrado = { centro: 0.4, alto: 0.25 };
    expect(tapa(posicionGancho(cuadrado, "1:1"), cuadrado, 0.095)).toBe(false);
  });

});
