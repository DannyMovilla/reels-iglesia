import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { crearProyecto, guardarJson, leerClips, leerMarca } from "../../../src/main/proyectos/almacen";

beforeEach(() => { process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-compat-")); });

test("una marca.json del plan 2 se lee con estilo, tamaño de logo y redes por defecto", async () => {
  writeFileSync(join(process.env.REELS_IGLESIA_DATOS!, "marca.json"), JSON.stringify({ nombre: "Iglesia Familia", color: "#123456", invitacion: "Ven" }));
  const m = await leerMarca();
  expect(m.nombre).toBe("Iglesia Familia");
  expect(m.logoEscala).toBe(1);
  expect(m.redes).toEqual({});
  expect(m.estilo.subtitulos).toEqual({ estilo: "pop", tamano: "m" });
});

test("una marca con estilo a medias completa lo que falta", async () => {
  writeFileSync(join(process.env.REELS_IGLESIA_DATOS!, "marca.json"), JSON.stringify({ estilo: { cierre: false } }));
  const m = await leerMarca();
  expect(m.estilo.cierre).toBe(false);
  expect(m.estilo.formatos).toEqual(["9:16", "4:5"]);
});

test("clips.json del plan 2 se lee completo", async () => {
  const p = await crearProyecto({ nombre: "Culto", video: { ruta: "C:/v.mp4", tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 90 } });
  await guardarJson(p.id, "clips.json", [{ id: "c", titulo: "T", categoria: "Reflexión", descripcion: "d", hashtags: [], musica: { pista: null, volumen: 0 } }]);
  const [c] = await leerClips(p.id);
  expect(c.musica.modo).toBe("ninguna");
  expect(c.redes.youtube.titulo).toBe("T");
  expect(c.cortes).toEqual({ pausas: true, muletillas: true });
});
