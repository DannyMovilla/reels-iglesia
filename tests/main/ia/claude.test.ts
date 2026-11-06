import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { crearCreacion, leerCreacion } from "../../../src/main/ia/almacen";
import { escribirCreacion, promptVersiculo } from "../../../src/main/ia/claude";

const FALSO = `node "${resolve(__dirname, "../../fixtures/claude/falso-claude.mjs")}"`;
beforeEach(() => { process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-iac-")); delete process.env.FALSO_CLAUDE_MODO; });

test("el prompt pide RVR1960 palabra por palabra, una o dos frases de reflexión, escena y sin clichés de IA", () => {
  const p = promptVersiculo({ tipo: "tema", texto: "esperanza en la prueba" });
  expect(p).toContain("REEL DE VERSÍCULO");
  expect(p).toContain("Reina-Valera 1960");
  expect(p).toContain("esperanza en la prueba");
  for (const e of ["luz", "amanecer", "aurora", "nubes", "atardecer", "destello"]) expect(p).toContain(e);
  expect(p).toMatch(/no es X, es Y/);
});

test("Claude llena la creación; el versículo queda sin confirmar", async () => {
  const c = await crearCreacion({ tipo: "versiculo", texto: "Juan 8:12" });
  await escribirCreacion(c.id, { comando: FALSO });
  const r = await leerCreacion(c.id);
  expect(r.versiculo).toEqual({ ref: "Juan 8:12", texto: expect.stringContaining("Yo soy la luz del mundo"), confirmado: false });
  expect(r.gancho).toBe("No tienes que caminar a oscuras");
  expect(r.reflexion).toMatch(/Jesús sigue siendo tu luz/);
  expect(r.palabrasClave).toEqual(["luz", "tinieblas", "vida"]);
  expect(r.musica.animo).toBe("esperanza");
  expect(r.fondo).toEqual({ tipo: "escena", escena: "luz" });
  expect(r.redes.youtube.titulo).toBe("Yo soy la luz del mundo | Juan 8:12");
});

test("si Claude no encuentra el versículo, error claro y la creación queda editable", async () => {
  process.env.FALSO_CLAUDE_MODO = "versiculo-vacio";
  const c = await crearCreacion({ tipo: "versiculo", texto: "Hezequías 4:99" });
  await expect(escribirCreacion(c.id, { comando: FALSO })).rejects.toThrow("Claude no encontró ese versículo. Escríbelo a mano o prueba con otra referencia.");
  expect((await leerCreacion(c.id)).estado).toBe("borrador");
});

test("revisión I4: datos raros de Claude (null, texto en vez de lista) no dan un error técnico", async () => {
  const { leerRespuestaVersiculo } = await import("../../../src/main/ia/claude");
  const r = leerRespuestaVersiculo({ ref: "Juan 8:12", texto: "Yo soy la luz", gancho: null, reflexion: 5, palabras_clave: "luz, vida", animo: "rarísimo", escena: null });
  expect(r).toMatchObject({ ref: "Juan 8:12", gancho: "", reflexion: "", palabras_clave: [] });
  expect(r.animo).toBeUndefined();
});
