import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { aplicarCambios, pedirCambios, promptCambios } from "../../../src/main/claude/cambios";
import { crearProyecto, guardarJson } from "../../../src/main/proyectos/almacen";
import { palabrasDe } from "../../../src/shared/reel/tiempo";
import type { ClipSpec, Transcripcion } from "../../../src/shared/tipos";
import { PLAN3 } from "../../ayuda/plan3";

const FIX = resolve(__dirname, "../../fixtures");
const muestra = (): Transcripcion => JSON.parse(readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8"));
const palabras = palabrasDe(muestra());
const rango = { inicio: 0, fin: 75 };
const clip: ClipSpec = {
  id: "c1", titulo: "El quebrantamiento", gancho: "Original", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46,
  apertura: null, palabrasClave: [], versiculos: [{ ref: "Salmos 51:17", texto: "Los sacrificios…", en: 10, activo: true, confirmado: true }],
  puntaje: 90, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3, cierre: true, formatos: ["9:16"], estado: "sugerido",
};

describe("aplicarCambios", () => {
  test("nuevo corte ajustado a palabras; el versículo sigue en su momento del video", () => {
    const r = aplicarCambios(clip, { resumen: "ok", inicio: "0:00:35.8", fin: "0:00:54.7" }, palabras, rango);
    expect(r.avisos).toEqual([]);
    expect(r.clip.inicio).toBe(35.75);
    expect(r.clip.fin).toBe(54.8);
    expect(r.clip.versiculos[0].en).toBeCloseTo(30.93 + 10 - 35.75, 2);
    expect(r.clip.versiculos[0].texto).toBe("Los sacrificios…");
    expect(r.clip.estado).toBe("editado");
  });

  test("tiempos al revés o fuera de la prédica se ignoran con un aviso (Review Focus 2)", () => {
    const alReves = aplicarCambios(clip, { resumen: "", inicio: "0:00:50", fin: "0:00:40" }, palabras, rango);
    expect([alReves.clip.inicio, alReves.clip.fin]).toEqual([clip.inicio, clip.fin]);
    expect(alReves.avisos[0]).toMatch(/^No pude usar el nuevo corte: /);
    const fuera = aplicarCambios(clip, { resumen: "", fin: "0:02:00" }, palabras, rango);
    expect(fuera.clip.fin).toBe(clip.fin);
    expect(fuera.avisos[0]).toMatch(/fuera de la prédica/);
  });

  test("un corte de 2 s se alarga a 5 s", () => {
    const r = aplicarCambios(clip, { resumen: "", inicio: "0:00:40.3", fin: "0:00:42.3" }, palabras, rango);
    expect(r.clip.fin - r.clip.inicio).toBeGreaterThanOrEqual(5);
  });

  test("textos, ánimo, estilo y tramos a quitar; un estilo desconocido se ignora", () => {
    const r = aplicarCambios(clip, {
      resumen: "", titulo: " Nuevo ", gancho: "Más fuerte", palabras_clave: ["gloria"], animo: "victoria", estilo_subtitulos: "neon",
      quitar: [{ desde: "0:00:40", hasta: "0:00:41.5" }, { desde: "0:05:00", hasta: "0:05:01" }],
    }, palabras, rango);
    expect(r.clip).toMatchObject({ titulo: "Nuevo", gancho: "Más fuerte", palabrasClave: ["gloria"] });
    expect(r.clip.musica.animo).toBe("victoria");
    expect(r.clip.subtitulos.estilo).toBe("neon");
    expect(r.clip.cortes.quitados).toEqual([{ inicio: 40.1, fin: 41.16 }]); // ajustado a palabras completas
    expect(aplicarCambios(clip, { resumen: "", estilo_subtitulos: "rarisimo" }, palabras, rango).clip.subtitulos.estilo).toBe("pop");
  });

  test("la frase de apertura se busca dentro del clip", () => {
    const r = aplicarCambios(clip, { resumen: "", apertura_frase: "inmediatamente se va a activar la gloria celestial" }, palabras, rango);
    expect(r.clip.apertura?.activa).toBe(true);
    expect(r.clip.apertura?.frase).toMatch(/inmediatamente/);
    const no = aplicarCambios(clip, { resumen: "", apertura_frase: "esto nunca lo dijo el pastor" }, palabras, rango);
    expect(no.clip.apertura).toBeNull();
    expect(no.avisos[0]).toMatch(/No encontré la frase de apertura/);
  });
});

test("el prompt lleva la marca, el pedido, el clip, la transcripción cercana y el historial", () => {
  const p = promptCambios(clip, muestra(), "hazlo de menos de 30 segundos", [{ pedido: "otro gancho", resumen: "Cambié el gancho." }]);
  expect(p).toContain("CAMBIOS DE UN CLIP");
  expect(p).toContain("hazlo de menos de 30 segundos");
  expect(p).toContain("otro gancho");
  expect(p).toContain("Cambié el gancho.");
  expect(p).toMatch(/\[0:00:3\d\.\d\]/);
  expect(p).toContain("Nunca agregues ni cambies versículos");
  expect(p).toContain('"inicio":"0:00:30.9"');
});

describe("pedirCambios con el Claude falso", () => {
  let id: string;
  const comando = `node ${join(FIX, "claude/falso-claude.mjs")}`;
  beforeEach(async () => {
    process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-cambios-"));
    const v = join(mkdtempSync(join(tmpdir(), "reels-v-")), "v.mp4");
    writeFileSync(v, "x");
    id = (await crearProyecto({ nombre: "Culto", video: { ruta: v, tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
    await guardarJson(id, "transcripcion.json", muestra());
  });

  test("devuelve el clip cambiado y el resumen", async () => {
    process.env.FALSO_CLAUDE_MODO = "ok";
    const r = await pedirCambios(id, clip, "más corto", [], { comando });
    expect(r.resumen).toMatch(/Acorté el clip/);
    expect(r.clip.gancho).toBe("Tu quebranto activa la gloria");
    expect(r.clip.fin).toBe(54.8);
  });

  test("respuesta sin formato: un reintento y luego un error en español", async () => {
    process.env.FALSO_CLAUDE_MODO = "cambios-invalido";
    await expect(pedirCambios(id, clip, "más corto", [], { comando })).rejects.toThrow("Claude no devolvió cambios válidos. Prueba con otras palabras.");
  });
});

test("revisión I2: los tramos que Claude quita se ajustan a palabras completas y se recortan al clip", () => {
  // "inmediatamente" va de 51,64 a 52,16 y "celestial" de 54,26 a 54,8.
  const r = aplicarCambios(clip, { resumen: "", quitar: [{ desde: "0:00:51.9", hasta: "0:00:54.6" }, { desde: "0:01:03.0", hasta: "0:01:10" }] }, palabras, rango);
  expect(r.clip.cortes.quitados![0]).toEqual({ inicio: 51.64, fin: 54.8 });
  expect(r.clip.cortes.quitados![1].inicio).toBeGreaterThanOrEqual(clip.inicio);
  expect(r.clip.cortes.quitados![1].fin).toBeLessThanOrEqual(clip.fin);
});

test("revisión I3: no se quitan tramos que dejarían el clip con menos de 5 s", () => {
  const r = aplicarCambios(clip, { resumen: "", quitar: [{ desde: "0:00:31", hasta: "0:01:03" }] }, palabras, rango);
  expect(r.clip.cortes.quitados ?? []).toEqual([]);
  expect(r.avisos.join(" ")).toMatch(/menos de 5 segundos/);
});
