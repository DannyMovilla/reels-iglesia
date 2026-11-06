import { expect, test } from "vitest";
import { LIMITES_REDES, recortarRedes } from "../../src/shared/redes";
import type { Redes } from "../../src/shared/tipos";

const base: Redes = { instagram: { texto: "a", hashtags: [] }, tiktok: { texto: "b", hashtags: [] }, facebook: { texto: "c" }, youtube: { titulo: "d", texto: "e" } };

test("límites de cada red", () => {
  expect(LIMITES_REDES).toEqual({
    instagram: { texto: 2200, hashtags: 30 }, tiktok: { texto: 2200 }, facebook: { texto: 5000 }, youtube: { titulo: 100, texto: 5000 },
  });
});

test("recorta en una palabra completa y deja hasta 30 hashtags en Instagram", () => {
  const titulo = "Dios no ha terminado contigo ".repeat(6).trim(); // 173 caracteres
  const r = recortarRedes({ ...base, youtube: { titulo, texto: "x" }, instagram: { texto: "y", hashtags: Array.from({ length: 40 }, (_, i) => `#h${i}`) } });
  expect(r.youtube.titulo.length).toBeLessThanOrEqual(100);
  expect(titulo.startsWith(r.youtube.titulo)).toBe(true);
  expect(r.youtube.titulo.endsWith("contigo") || r.youtube.titulo.endsWith("Dios") || / \S+$/.test(r.youtube.titulo)).toBe(true);
  expect(titulo[r.youtube.titulo.length]).toBe(" ");
  expect(r.instagram.hashtags).toHaveLength(30);
});

test("lo que cabe no cambia", () => {
  expect(recortarRedes(base)).toEqual(base);
});
