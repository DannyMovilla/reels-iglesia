import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { cancelarFrases, guardarFrases, guardarImagenesFrases, leerFrases, promptFrases, sacarFrases } from "../../../src/main/entregas/frases";
import { crearProyecto, guardarJson } from "../../../src/main/proyectos/almacen";
import { carpetaProyecto } from "../../../src/main/rutas";
import type { Frase } from "../../../src/shared/frases";

const FIX = resolve(__dirname, "../../fixtures");
const comando = `node ${join(FIX, "claude/falso-claude.mjs")}`;
const muestra = readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8");
let id: string;
let video: string;

beforeEach(async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-frases-"));
  video = join(mkdtempSync(join(tmpdir(), "reels-v-")), "culto (1).mp4");
  writeFileSync(video, "x");
  id = (await crearProyecto({ nombre: "Culto", video: { ruta: video, tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75.09 } })).id;
  await guardarJson(id, "transcripcion.json", JSON.parse(muestra));
  process.env.FALSO_CLAUDE_MODO = "ok";
  delete process.env.FALSO_CLAUDE_CONTADOR;
});

test("el prompt pide frases textuales con su minuto y prohíbe inventar versículos", () => {
  const p = promptFrases("[0:00:39] Y ese quebrantamiento terrenal va a activar la gloria celestial");
  expect(p.startsWith("FRASES DE LA PRÉDICA.")).toBe(true);
  expect(p).toContain("palabra por palabra");
  expect(p).toContain("10");
  expect(p).toMatch(/nunca agregues versículos/i);
  expect(p).toContain("[0:00:39] Y ese quebrantamiento");
});

describe("sacarFrases", () => {
  test("7 frases fieles en orden, el versículo sin confirmar y frases.json guardado", async () => {
    const r = await sacarFrases(id, { comando });
    expect(r.aviso).toBeUndefined();
    expect(r.frases).toHaveLength(7);
    expect(r.frases.map((f) => f.en)).toEqual([...r.frases.map((f) => f.en)].sort((a, b) => a - b));
    expect(r.frases.some((f) => /Señor nunca te dejará/.test(f.texto))).toBe(false);
    const conVers = r.frases.find((f) => f.versiculo)!;
    expect(conVers.versiculo).toMatchObject({ ref: "Salmos 51:17", confirmado: false });
    expect(await leerFrases(id)).toEqual(r.frases);
  });

  test("si la primera respuesta no trae JSON, un reintento", async () => {
    process.env.FALSO_CLAUDE_MODO = "frases-invalido-luego-ok";
    process.env.FALSO_CLAUDE_CONTADOR = join(mkdtempSync(join(tmpdir(), "reels-cont-")), "n");
    const r = await sacarFrases(id, { comando });
    expect(r.frases).toHaveLength(7);
    expect(readFileSync(process.env.FALSO_CLAUDE_CONTADOR, "utf8")).toBe("2");
  });

  test("sin transcripción: error legible", async () => {
    rmSync(join(carpetaProyecto(id), "transcripcion.json"));
    await expect(sacarFrases(id, { comando })).rejects.toThrow("Primero hay que transcribir la prédica.");
  });

  test("si Claude solo inventa: error legible", async () => {
    process.env.FALSO_CLAUDE_MODO = "frases-inventadas";
    await expect(sacarFrases(id, { comando })).rejects.toThrow("Claude no encontró frases textuales. Prueba de nuevo.");
  });

  test("no se piden dos veces a la vez y se puede cancelar", async () => {
    process.env.FALSO_CLAUDE_MODO = "frases-lenta";
    const primera = sacarFrases(id, { comando });
    await expect(sacarFrases(id, { comando })).rejects.toThrow("Ya se están sacando las frases de esta prédica.");
    expect(cancelarFrases(id)).toBe(true);
    await expect(primera).rejects.toThrow("Se canceló.");
    expect(cancelarFrases(id)).toBe(false);
  });

  test("un id con rutas se rechaza", async () => {
    await expect(sacarFrases("../x", { comando })).rejects.toThrow("Proyecto no válido.");
  });
});

describe("guardarImagenesFrases", () => {
  const pintar = async (html: string) => {
    pintadas.push(html);
    return Buffer.from([1]);
  };
  let pintadas: string[] = [];
  beforeEach(() => { pintadas = []; });

  test("7 PNG y el .txt con minuto y predicador; el versículo sin confirmar no sale", async () => {
    const { frases } = await sacarFrases(id, { comando });
    const r = await guardarImagenesFrases(id, pintar);
    expect(r.avisos).toEqual([]);
    const dir = join(carpetaProyecto(id), "exportados", "frases");
    expect(readdirSync(dir).sort()).toEqual(Array.from({ length: 7 }, (_, i) => `culto-frase-${i + 1}.png`));
    expect(r.archivos).toHaveLength(8);
    const txt = readFileSync(join(carpetaProyecto(id), "exportados", "culto-frases.txt"), "utf8");
    expect(txt).toContain(`«${frases[0].texto}» — 0:00`);
    expect(txt).not.toContain("Salmos 51:17");
    expect(pintadas.join("")).not.toContain("Salmos 51:17");
  });

  test("el versículo confirmado sí sale en la imagen y en el texto", async () => {
    const { frases } = await sacarFrases(id, { comando });
    await guardarFrases(id, frases.map((f) => (f.versiculo ? { ...f, versiculo: { ...f.versiculo, confirmado: true } } : f)));
    await guardarImagenesFrases(id, pintar);
    expect(pintadas.join("")).toContain("Salmos 51:17");
    expect(readFileSync(join(carpetaProyecto(id), "exportados", "culto-frases.txt"), "utf8")).toContain("Salmos 51:17");
  });

  test("sin el video original, la foto del momento sale con el fondo de la marca y un aviso", async () => {
    const { frases } = await sacarFrases(id, { comando });
    await guardarFrases(id, frases.map((f, i): Frase => (i === 0 ? { ...f, fondo: "momento" } : f)));
    rmSync(video);
    const r = await guardarImagenesFrases(id, pintar);
    expect(r.avisos).toEqual(["La foto del momento no está disponible: el video original no se encuentra."]);
    expect(existsSync(join(carpetaProyecto(id), "exportados", "frases", "culto-frase-1.png"))).toBe(true);
    expect(pintadas[0]).toContain("linear-gradient(160deg");
  });

  test("revisión: un versículo mal formado en frases.json se quita sin romper", async () => {
    await guardarFrases(id, [{ texto: "x", en: 1, original: "x", fondo: "marca", versiculo: { ref: 3 } } as unknown as Frase]);
    expect(await leerFrases(id)).toEqual([{ texto: "x", en: 1, original: "x", fondo: "marca" }]);
  });

  test("revisión: al volver a guardar con menos frases no quedan imágenes viejas", async () => {
    const { frases } = await sacarFrases(id, { comando });
    await guardarImagenesFrases(id, pintar);
    await guardarFrases(id, frases.slice(0, 5));
    await guardarImagenesFrases(id, pintar);
    const dir = join(carpetaProyecto(id), "exportados", "frases");
    expect(readdirSync(dir).filter((f) => f.endsWith(".png")).sort()).toEqual(Array.from({ length: 5 }, (_, i) => `culto-frase-${i + 1}.png`));
  });

  test("sin frases: error legible", async () => {
    await expect(guardarImagenesFrases(id, pintar)).rejects.toThrow("Primero saca las frases de la prédica.");
  });

  test("guardarFrases ignora lo que no es una frase", async () => {
    await guardarFrases(id, [{ texto: "x", en: 1, original: "x", fondo: "marca" }, { nada: 1 } as unknown as Frase]);
    expect(await leerFrases(id)).toEqual([{ texto: "x", en: 1, original: "x", fondo: "marca" }]);
  });
});
