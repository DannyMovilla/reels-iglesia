import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { guardarSrt } from "../../../src/main/entregas/entregas";
import { corregir, crearProyecto, guardarJson } from "../../../src/main/proyectos/almacen";
import { carpetaProyecto } from "../../../src/main/rutas";
import { leerSrt } from "../../../src/shared/srt";

const FIX = resolve(__dirname, "../../fixtures");
let id: string;

beforeEach(async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-ent-"));
  const v = join(mkdtempSync(join(tmpdir(), "reels-v-")), "v.mp4");
  writeFileSync(v, "x");
  id = (await crearProyecto({ nombre: "Culto dominical · 9 nov", video: { ruta: v, tamano: 1, modificado: 0, duracion: 9000 }, rango: { inicio: 0, fin: 75 } })).id;
  await guardarJson(id, "transcripcion.json", JSON.parse(readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8")));
});

test("guarda el SRT de la prédica en exportados, con la transcripción corregida", async () => {
  await corregir(id, { de: "quebrantamiento", a: "QUEBRANTO" });
  const nombre = await guardarSrt(id, { completo: true });
  expect(nombre).toBe("culto-dominical-9-nov.srt");
  const texto = readFileSync(join(carpetaProyecto(id), "exportados", nombre), "utf8");
  expect(texto).toContain("QUEBRANTO");
  expect(texto.startsWith("1\n00:00:00,000 --> ")).toBe(true);
  expect(leerSrt(texto).length).toBeGreaterThan(5);
});

test("con tiempos del video completo suma el inicio de la prédica", async () => {
  const t = JSON.parse(readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8"));
  const desplazar = (x: number) => x + 6284;
  t.inicio = 6284; t.fin = desplazar(t.fin);
  t.segmentos = t.segmentos.map((s: { s: number; e: number; w: [number, number, string][] }) => ({ ...s, s: desplazar(s.s), e: desplazar(s.e), w: s.w.map(([a, b, x]) => [desplazar(a), desplazar(b), x]) }));
  await guardarJson(id, "transcripcion.json", t);
  const completo = leerSrt(readFileSync(join(carpetaProyecto(id), "exportados", await guardarSrt(id, { completo: true })), "utf8"));
  const predica = leerSrt(readFileSync(join(carpetaProyecto(id), "exportados", await guardarSrt(id, { completo: false })), "utf8"));
  expect(completo[0].desde).toBeCloseTo(6284, 1);
  expect(predica[0].desde).toBeCloseTo(0, 1);
});

test("PDF: arma el HTML con la transcripción corregida y guarda lo que imprime Electron", async () => {
  const { guardarPdf } = await import("../../../src/main/entregas/pdf");
  await corregir(id, { de: "quebrantamiento", a: "QUEBRANTO" });
  let html = "";
  const nombre = await guardarPdf(id, async (h) => { html = h; return Buffer.from("%PDF-1.7 prueba"); });
  expect(nombre).toBe("culto-dominical-9-nov-transcripcion.pdf");
  expect(html).toContain("QUEBRANTO");
  expect(html).toContain("<h1>Culto dominical · 9 nov</h1>");
  expect(readFileSync(join(carpetaProyecto(id), "exportados", nombre), "utf8")).toBe("%PDF-1.7 prueba");
});
