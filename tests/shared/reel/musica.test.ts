import { expect, test } from "vitest";
import { curvaMusica, tramosDeVoz, valorEn } from "../../../src/shared/reel/musica";
import type { Parte } from "../../../src/shared/reel/tiempo";

test("la música entra fuerte, baja bajo la voz, sube en pausas largas y se desvanece al final", () => {
  const c = curvaMusica([{ desde: 0.5, hasta: 6 }, { desde: 8, hasta: 20 }], 22, 0.12);
  expect(valorEn(c, 0)).toBe(0.5);
  expect(valorEn(c, 1.8)).toBe(0.5);
  expect(valorEn(c, 4)).toBeCloseTo(0.12);
  expect(valorEn(c, 7)).toBeCloseTo(0.24);
  expect(valorEn(c, 15)).toBeCloseTo(0.12);
  expect(valorEn(c, 22)).toBe(0);
  expect(Math.max(...c.map((p) => p.v))).toBeLessThanOrEqual(0.5);
  for (let i = 1; i < c.length; i++) expect(c[i].t).toBeGreaterThanOrEqual(c[i - 1].t);
});

test("una pausa corta no hace subir la música y el volumen de pausa nunca pasa de 0,3", () => {
  const c = curvaMusica([{ desde: 0, hasta: 5 }, { desde: 6, hasta: 10 }], 14, 0.2);
  expect(valorEn(c, 5.5)).toBeCloseTo(0.2);
  expect(valorEn(c, 12)).toBeCloseTo(0.3); // pausa del cierre: 2 × 0,2 = 0,4 → máx. 0,3
});

test("tramos de voz en tiempo de reel a partir de las palabras de cada parte", () => {
  const partes: Parte[] = [
    { tipo: "apertura", inicioVideo: 100, finVideo: 104, inicioReel: 0, duracion: 4 },
    { tipo: "clip", inicioVideo: 90, finVideo: 110, inicioReel: 4, duracion: 20 },
    { tipo: "cierre", inicioVideo: 0, finVideo: 0, inicioReel: 24, duracion: 2.6 },
  ];
  const palabras = [{ s: 90.5, e: 91, t: "a" }, { s: 91.2, e: 92, t: "b" }, { s: 95, e: 96, t: "c" }, { s: 101, e: 102, t: "d" }];
  expect(tramosDeVoz(partes, palabras)).toEqual([
    { desde: 1, hasta: 2 },
    { desde: 4.5, hasta: 6 },
    { desde: 9, hasta: 10 },
    { desde: 15, hasta: 16 },
  ]);
});
