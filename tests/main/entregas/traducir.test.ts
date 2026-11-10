import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { promptTraduccion, traducirSrt } from "../../../src/main/entregas/traducir";
import { crearProyecto, guardarJson } from "../../../src/main/proyectos/almacen";
import { carpetaProyecto } from "../../../src/main/rutas";
import { palabrasDe } from "../../../src/shared/reel/tiempo";
import { bloquesSrt, leerSrt } from "../../../src/shared/srt";
import type { Transcripcion } from "../../../src/shared/tipos";

const FIX = resolve(__dirname, "../../fixtures");
const comando = `node ${join(FIX, "claude/falso-claude.mjs")}`;
let id: string;

/** Una prédica larga: 300 oraciones cortas separadas por pausas (un bloque cada una). */
function larga(): Transcripcion {
  const segmentos = Array.from({ length: 300 }, (_, i) => {
    const s = i * 4;
    return { s, e: s + 2, t: `Oración número ${i}.`, w: [[s, s + 0.6, "Oración"], [s + 0.7, s + 1.3, "número"], [s + 1.4, s + 2, `${i}.`]] as [number, number, string][] };
  });
  return { formato: "pulpito-transcripcion/1", inicio: 0, fin: 1200, modelo: "m", dispositivo: "cpu", segmentos };
}

beforeEach(async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-trad-"));
  const v = join(mkdtempSync(join(tmpdir(), "reels-v-")), "v.mp4");
  writeFileSync(v, "x");
  id = (await crearProyecto({ nombre: "Culto", video: { ruta: v, tamano: 1, modificado: 0, duracion: 2000 }, rango: { inicio: 0, fin: 1200 } })).id;
  await guardarJson(id, "transcripcion.json", larga());
  process.env.FALSO_CLAUDE_MODO = "ok";
});

test("el prompt lleva la marca, el idioma, las reglas y los bloques numerados", () => {
  const b = bloquesSrt(palabrasDe(larga())).slice(0, 3);
  const p = promptTraduccion(b, "en", 120);
  expect(p).toContain("TRADUCCIÓN DE SUBTÍTULOS");
  expect(p).toContain("idioma: en (inglés)");
  expect(p).toContain("42 caracteres");
  expect(p).toContain("versión reconocida");
  const json = JSON.parse(p.slice(p.indexOf("Bloques (JSON):") + "Bloques (JSON):".length));
  expect(json[0]).toEqual({ n: 121, texto: "Oración número 0." });
});

test("300 bloques → 3 partes en orden, con los tiempos originales; dos idiomas → dos archivos", async () => {
  const pasos: string[] = [];
  const nombres = await traducirSrt(id, ["en", "pt"], { comando, alProgreso: (t) => pasos.push(t) });
  expect(nombres).toEqual(["culto.en.srt", "culto.pt.srt"]);
  const original = bloquesSrt(palabrasDe(larga()));
  expect(original.length).toBe(300);
  const en = leerSrt(readFileSync(join(carpetaProyecto(id), "exportados", "culto.en.srt"), "utf8"));
  expect(en.length).toBe(300);
  en.forEach((b, i) => {
    expect(b.desde).toBe(original[i].desde);
    expect(b.hasta).toBe(original[i].hasta);
    expect(b.texto).toBe(`[en] ${original[i].texto}`);
  });
  expect(pasos).toContain("Traduciendo al inglés (parte 3 de 3)…");
  expect(pasos).toContain("Traduciendo al portugués (parte 1 de 3)…");
});

test("una parte con un bloque de menos: se reintenta y luego error claro, sin archivo", async () => {
  process.env.FALSO_CLAUDE_MODO = "traduccion-corta";
  await expect(traducirSrt(id, ["fr"], { comando })).rejects.toThrow("No pude traducir al francés. Prueba de nuevo.");
  expect(existsSync(join(carpetaProyecto(id), "exportados", "culto.fr.srt"))).toBe(false);
});

test("un idioma desconocido se rechaza", async () => {
  await expect(traducirSrt(id, ["xx"], { comando })).rejects.toThrow("Ese idioma no está disponible.");
});

test("revisión I4: con «solo la prédica» la traducción usa los mismos tiempos que el SRT en español", async () => {
  const t = larga();
  const corrido = { ...t, inicio: 100, fin: 1300, segmentos: t.segmentos.map((s) => ({ ...s, s: s.s + 100, e: s.e + 100, w: s.w.map(([a, b, x]) => [a + 100, b + 100, x] as [number, number, string]) })) };
  await guardarJson(id, "transcripcion.json", corrido);
  await traducirSrt(id, ["en"], { comando, completo: false });
  const en = leerSrt(readFileSync(join(carpetaProyecto(id), "exportados", "culto.en.srt"), "utf8"));
  expect(en[0].desde).toBeCloseTo(0, 2);
  await traducirSrt(id, ["en"], { comando });
  const enCompleto = leerSrt(readFileSync(join(carpetaProyecto(id), "exportados", "culto.en.srt"), "utf8"));
  expect(enCompleto[0].desde).toBeCloseTo(100, 2);
});

test("plan 7: si la consulta falla la primera vez, se reintenta esa parte", async () => {
  const contador = join(mkdtempSync(join(tmpdir(), "reels-cont-")), "n.txt");
  process.env.FALSO_CLAUDE_CONTADOR = contador;
  process.env.FALSO_CLAUDE_MODO = "traduccion-error-primera";
  expect(await traducirSrt(id, ["en"], { comando })).toEqual(["culto.en.srt"]);
  delete process.env.FALSO_CLAUDE_CONTADOR;
});

test("plan 7: una sola traducción a la vez por prédica; cancelar no deja un .srt a medias", async () => {
  const { cancelarTraduccion } = await import("../../../src/main/entregas/traducir");
  process.env.FALSO_CLAUDE_MODO = "traduccion-lenta";
  const primera = traducirSrt(id, ["it"], { comando });
  await new Promise((r) => setTimeout(r, 300));
  await expect(traducirSrt(id, ["de"], { comando })).rejects.toThrow("Ya se está traduciendo esta prédica.");
  expect(cancelarTraduccion(id)).toBe(true);
  await expect(primera).rejects.toThrow("Se canceló la traducción.");
  expect(existsSync(join(carpetaProyecto(id), "exportados", "culto.it.srt"))).toBe(false);
  expect(cancelarTraduccion(id)).toBe(false);
}, 20_000);
