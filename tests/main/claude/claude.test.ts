import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { analizarProyecto } from "../../../src/main/claude/analizar";
import { extraerJson } from "../../../src/main/claude/analizar";
import { RespuestaClaude } from "../../../src/main/claude/esquema";
import { normalizarClips } from "../../../src/main/claude/normalizar";
import { construirPrompt } from "../../../src/main/claude/prompt";
import { crearProyecto, guardarJson, leerJson } from "../../../src/main/proyectos/almacen";
import type { ClipSpec, Transcripcion } from "../../../src/shared/tipos";

const FIX = resolve(__dirname, "../../fixtures");
const muestra = (): Transcripcion => JSON.parse(readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8"));
const respuesta = () => RespuestaClaude.parse(JSON.parse(readFileSync(join(FIX, "claude/respuesta-ok.json"), "utf8")));
const ctx = { alProgreso: () => {}, senal: new AbortController().signal };

test("construirPrompt incluye marcas H:MM:SS y pide ganchos alternativos y versículos", () => {
  const t: Transcripcion = { formato: "pulpito-transcripcion/1", inicio: 6284, fin: 9155, modelo: "x", dispositivo: "cpu",
    segmentos: [{ s: 6284, e: 6291, t: "Hermanos", w: [] }] };
  const p = construirPrompt(t, 6);
  expect(p).toContain("[1:44:44 - 1:44:51] Hermanos");
  expect(p).toContain("ganchos_alternativos");
  expect(p).toContain("versiculos");
  expect(p).toContain("Reina-Valera 1960");
});

test("extraerJson saca el JSON de un bloque de código rodeado de texto", () => {
  expect(extraerJson('Aquí van:\n```json\n[{"a":1}]\n```\nBendiciones')).toEqual([{ a: 1 }]);
  expect(extraerJson('[{"a":2}]')).toEqual([{ a: 2 }]);
  expect(() => extraerJson("sin json")).toThrow("Claude no devolvió una lista de clips válida");
});

test("el esquema acepta categorías sin tilde y las corrige", () => {
  expect(respuesta()[1].categoria).toBe("Reflexión");
});

test("normalizarClips ajusta a los segmentos, ubica la apertura y aplica los valores por defecto", () => {
  const clips: ClipSpec[] = normalizarClips(respuesta(), muestra());
  expect(clips).toHaveLength(1); // el de 1 s se descarta
  const c = clips[0];
  expect(c.inicio).toBe(30.93);
  expect(c.fin).toBe(63.46);
  expect(c.apertura?.frase.toLowerCase().startsWith("ese quebrantamiento terrenal")).toBe(true);
  expect(c.apertura?.activa).toBe(true);
  expect(c.ganchosAlternativos).toEqual(["Cuando te humillas, Dios responde", "¿Oras o solo hablas?"]);
  expect(c.formatos).toEqual(["9:16", "4:5"]);
  expect(c.encuadre).toEqual({ modo: "auto", x: 0.5, zoom: 1.25 });
  expect(c.versiculos[0]).toMatchObject({ ref: "Salmos 51:17", activo: true, confirmado: false });
  expect(c.versiculos[0].texto).toMatch(/^Los sacrificios de Dios/);
  expect(c.versiculos[0].en).toBe(16.29); // "cuando" se dice en 47.22; el clip empieza en 30.93
  expect(c.estado).toBe("sugerido");
});

describe("analizarProyecto con un claude falso", () => {
  let id: string;
  let contador: string;
  const comando = `node ${join(FIX, "claude/falso-claude.mjs")}`;
  beforeEach(async () => {
    process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-claude-"));
    const v = join(mkdtempSync(join(tmpdir(), "reels-v-")), "v.mp4");
    writeFileSync(v, "x");
    id = (await crearProyecto({ nombre: "Culto", video: { ruta: v, tamano: statSync(v).size, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
    await guardarJson(id, "transcripcion.json", muestra());
    contador = join(mkdtempSync(join(tmpdir(), "reels-cont-")), "n.txt");
    process.env.FALSO_CLAUDE_CONTADOR = contador;
  });

  test("ok: guarda clips.json", async () => {
    process.env.FALSO_CLAUDE_MODO = "ok";
    await analizarProyecto(id, ctx, { comando });
    const clips = await leerJson<ClipSpec[]>(id, "clips.json");
    expect(clips?.[0].titulo).toBe("El quebrantamiento activa la gloria");
  });

  test("respuesta inválida: reintenta una vez y termina bien", async () => {
    process.env.FALSO_CLAUDE_MODO = "invalido-luego-ok";
    await analizarProyecto(id, ctx, { comando });
    expect(readFileSync(contador, "utf8")).toBe("2");
    expect((await leerJson<ClipSpec[]>(id, "clips.json"))?.length).toBe(1);
  });

  test("sin sesión: error que explica cómo iniciar sesión", async () => {
    process.env.FALSO_CLAUDE_MODO = "sin-sesion";
    await expect(analizarProyecto(id, ctx, { comando })).rejects.toThrow(
      "Claude no tiene sesión iniciada. Abre Ajustes → Iniciar sesión en Claude.",
    );
  });
});

test("el esquema tolera puntaje como texto y más de 3 ganchos alternativos", () => {
  const r = RespuestaClaude.parse([{ ...JSON.parse(readFileSync(join(FIX, "claude/respuesta-ok.json"), "utf8"))[0],
    puntaje: "92", ganchos_alternativos: ["a", "b", "c", "d"] }]);
  expect(r[0].puntaje).toBe(92);
  expect(r[0].ganchos_alternativos).toEqual(["a", "b", "c"]);
});

test("extraerJson busca la lista aunque Claude envuelva todo en un objeto", () => {
  expect(extraerJson('{"clips":[{"a":1}]}')).toEqual([{ a: 1 }]);
});

describe("analizarProyecto: errores legibles", () => {
  let id: string;
  const comando = `node ${join(FIX, "claude/falso-claude.mjs")}`;
  beforeEach(async () => {
    process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-claude2-"));
    const v = join(mkdtempSync(join(tmpdir(), "reels-v-")), "v.mp4");
    writeFileSync(v, "x");
    id = (await crearProyecto({ nombre: "Culto", video: { ruta: v, tamano: statSync(v).size, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
    await guardarJson(id, "transcripcion.json", muestra());
    delete process.env.FALSO_CLAUDE_CONTADOR;
  });

  test("inválido dos veces: mensaje en español, no un volcado técnico", async () => {
    process.env.FALSO_CLAUDE_MODO = "invalido-siempre";
    await expect(analizarProyecto(id, ctx, { comando })).rejects.toThrow("Claude no devolvió una lista de clips válida. Toca Reintentar.");
  });

  test("cero clips útiles: error que lo explica", async () => {
    process.env.FALSO_CLAUDE_MODO = "vacio";
    await expect(analizarProyecto(id, ctx, { comando })).rejects.toThrow(
      "Claude no encontró momentos de al menos 5 segundos. Revisa el rango de la prédica y toca Reintentar.",
    );
  });

  test("si Claude se cuelga, se corta con un mensaje", async () => {
    process.env.FALSO_CLAUDE_MODO = "colgado";
    await expect(analizarProyecto(id, ctx, { comando, tiempoMaximoMs: 800 })).rejects.toThrow(
      "Claude tardó demasiado en responder. Revisa tu conexión y toca Reintentar.",
    );
  });

  test("si Claude Code no está instalado, el error está en español", async () => {
    await expect(analizarProyecto(id, ctx, { comando: "no-existe-claude-xyz" })).rejects.toThrow(
      "No encuentro Claude Code en esta PC. Revisa Ajustes.",
    );
  });
});

test("el análisis guarda el texto RVR1960 de Claude sin confirmar y con la referencia canónica", async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-biblia-"));
  const v = join(mkdtempSync(join(tmpdir(), "reels-v-")), "v.mp4");
  writeFileSync(v, "x");
  const id = (await crearProyecto({ nombre: "Culto", video: { ruta: v, tamano: statSync(v).size, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
  await guardarJson(id, "transcripcion.json", muestra());
  process.env.FALSO_CLAUDE_MODO = "ok";
  delete process.env.FALSO_CLAUDE_CONTADOR;
  await analizarProyecto(id, ctx, { comando: `node ${join(FIX, "claude/falso-claude.mjs")}` });
  const clips = await leerJson<ClipSpec[]>(id, "clips.json");
  expect(clips?.[0].versiculos[0]).toMatchObject({ ref: "Salmos 51:17", confirmado: false, activo: true });
  expect(clips?.[0].versiculos[0].texto).toMatch(/^Los sacrificios de Dios/);
});


test("el ánimo y los textos por red vienen en el mismo análisis", async () => {
  const { RespuestaClaude } = await import("../../../src/main/claude/esquema");
  const r = RespuestaClaude.parse([{ titulo: "T", gancho: "G", categoria: "Esperanza", inicio: "0:00:01", fin: "0:00:40", puntaje: 90,
    animo: "Adoración", redes: { instagram: { texto: "i", hashtags: ["#fe"] }, tiktok: { texto: "t", hashtags: [] }, facebook: { texto: "f" }, youtube: { titulo: "y", texto: "yt" } } }]);
  expect(r[0].animo).toBe("adoracion");
  expect(r[0].redes?.youtube.titulo).toBe("y");
  const sinRedes = RespuestaClaude.parse([{ titulo: "T", gancho: "G", categoria: "Esperanza", inicio: "0:00:01", fin: "0:00:40", puntaje: 90 }]);
  expect(sinRedes[0].redes).toBeUndefined();
  expect(sinRedes[0].animo).toBeUndefined();
});

test("el prompt pide ánimo y textos por red con sus límites, sin sonar a IA", async () => {
  const { construirPrompt } = await import("../../../src/main/claude/prompt");
  const p = construirPrompt({ formato: "pulpito-transcripcion/1", inicio: 0, fin: 60, modelo: "", dispositivo: "", segmentos: [{ s: 0, e: 5, t: "Hola", w: [] }] }, 4);
  for (const a of ["reflexivo", "esperanza", "victoria", "adoracion", "tension"]) expect(p).toContain(a);
  expect(p).toContain("2200");
  expect(p).toContain("100 caracteres");
  expect(p).toMatch(/no es X, es Y/);
});

test("plan 5: volver a analizar conserva un favorito y reemplaza las sugerencias sin tocar", async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-claude-"));
  const v = join(mkdtempSync(join(tmpdir(), "reels-v-")), "v.mp4");
  writeFileSync(v, "x");
  const id = (await crearProyecto({ nombre: "Culto", video: { ruta: v, tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
  await guardarJson(id, "transcripcion.json", muestra());
  process.env.FALSO_CLAUDE_MODO = "ok";
  delete process.env.FALSO_CLAUDE_CONTADOR;
  const comando = `node ${join(FIX, "claude/falso-claude.mjs")}`;
  await analizarProyecto(id, ctx, { comando });
  const [primero] = (await leerJson<ClipSpec[]>(id, "clips.json"))!;
  await guardarJson(id, "clips.json", [{ ...primero, favorito: true }, { ...primero, id: "sin-tocar" }]);
  await analizarProyecto(id, ctx, { comando });
  const despues = (await leerJson<ClipSpec[]>(id, "clips.json"))!;
  expect(despues.find((x) => x.id === primero.id)?.favorito).toBe(true);
  expect(despues.some((x) => x.id === "sin-tocar")).toBe(false);
  expect(despues).toHaveLength(2);
});
