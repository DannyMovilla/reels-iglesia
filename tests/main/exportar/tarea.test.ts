import { existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { crearEjecutorExportar, nombreSalida, type DepsExportar } from "../../../src/main/exportar/tarea";
import { crearProyecto, guardarJson, leerJson } from "../../../src/main/proyectos/almacen";
import { carpetaProyecto } from "../../../src/main/rutas";
import type { ClipSpec, Tarea } from "../../../src/shared/tipos";
import { PLAN3, SIN_MUSICA } from "../../ayuda/plan3";

const FIX = resolve(__dirname, "../../fixtures");
const ctx = () => ({ alProgreso: () => {}, senal: new AbortController().signal });

test("nombres de archivo válidos en Windows y sin pisarse", () => {
  expect(nombreSalida("¿Oras o solo hablas? 🙏", "9:16", new Set())).toBe("oras-o-solo-hablas-9x16.mp4");
  expect(nombreSalida("¿Oras o solo hablas?", "9:16", new Set(["oras-o-solo-hablas-9x16.mp4"]))).toBe("oras-o-solo-hablas-2-9x16.mp4");
  expect(nombreSalida("", "4:5", new Set())).toBe("reel-4x5.mp4");
  expect(nombreSalida("Fe: \"Sí\" / No", "1:1", new Set())).toBe("fe-si-no-1x1.mp4");
  // Un título largo que se corta justo en un espacio no deja guion doble.
  const largo = nombreSalida(`${"a".repeat(59)} fin`, "9:16", new Set()); // el corte a 60 cae justo en el guion
  expect(largo).not.toMatch(/--/);
  expect(largo.length).toBeLessThanOrEqual(60 + "-9x16.mp4".length);
});

describe("ejecutor exportar", () => {
  let id: string;
  let video: string;
  let clip: ClipSpec;
  let llamadas: { gpu: boolean; html: string; salida: string }[];

  let normalizados: string[];
  let portadas: number[];
  let vocesCreadas: string[];
  const deps = (extra: Partial<DepsExportar> = {}): DepsExportar => ({
    gpu: async () => true,
    normalizar: async (mp4) => { normalizados.push(mp4); },
    musica: async () => null,
    portada: async (_mp4, t, salida) => { portadas.push(t); writeFileSync(salida, "jpg"); },
    crearVoz: async (_p, destino) => { vocesCreadas.push(destino); writeFileSync(destino, "m4a"); },
    dimensiones: async () => ({ ancho: 1280, alto: 720 }),
    renderizar: async (dir, salida, op) => {
      llamadas.push({ gpu: op.gpu, html: readFileSync(join(dir, "index.html"), "utf8"), salida });
      writeFileSync(salida, "mp4");
    },
    ...extra,
  });
  const tarea = (instantanea: ClipSpec): Tarea => ({ id: "t1", proyectoId: id, tipo: "exportar", estado: "corriendo", pct: 0, creada: "",
    clipId: instantanea.id, formato: "9:16", instantanea });

  beforeEach(async () => {
    process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-exp-"));
    video = join(mkdtempSync(join(tmpdir(), "reels-v-")), "culto (1280p).mp4");
    writeFileSync(video, "x");
    id = (await crearProyecto({ nombre: "Culto", video: { ruta: video, tamano: statSync(video).size, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
    await guardarJson(id, "transcripcion.json", JSON.parse(readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8")));
    clip = {
      id: "c1", titulo: "El quebrantamiento", gancho: "Original", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46,
      apertura: null, palabrasClave: [], versiculos: [], puntaje: 90, razon: "", descripcion: "", hashtags: [],
      encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
      ...PLAN3, musica: SIN_MUSICA, cierre: true, formatos: ["9:16"], estado: "sugerido",
    };
    await guardarJson(id, "clips.json", [clip]);
    llamadas = [];
    normalizados = [];
    portadas = [];
    vocesCreadas = [];
  });

  test("usa la versión del clip guardada al encolar, no los cambios posteriores", async () => {
    const t = tarea({ ...clip });
    await guardarJson(id, "clips.json", [{ ...clip, gancho: "Cambiado" }]);
    await crearEjecutorExportar(deps())(t, ctx());
    expect(llamadas[0].html).toContain("Original");
    expect(llamadas[0].html).not.toContain("Cambiado");
  });

  test("deja el MP4 en exportados, marca el clip como exportado y borra la carpeta temporal", async () => {
    await crearEjecutorExportar(deps())(tarea(clip), ctx());
    expect(readdirSync(join(carpetaProyecto(id), "exportados"))).toContain("el-quebrantamiento-9x16.mp4");
    expect((await leerJson<ClipSpec[]>(id, "clips.json"))?.[0].estado).toBe("exportado");
    expect(existsSync(join(carpetaProyecto(id), "tmp", "t1"))).toBe(false);
  });

  test("un video con # o ? en la ruta se pasa a HyperFrames como un archivo de la carpeta temporal (no se corta la ruta)", async () => {
    const raro = join(mkdtempSync(join(tmpdir(), "reels-v-")), "Culto #45 ¿fe.mp4");
    writeFileSync(raro, "x");
    const otro = (await crearProyecto({ nombre: "Culto 45", video: { ruta: raro, tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
    await guardarJson(otro, "transcripcion.json", JSON.parse(readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8")));
    let src = "";
    let existe = false;
    await crearEjecutorExportar(deps({
      renderizar: async (dir, salida) => {
        src = /<video[^>]*\ssrc="([^"]+)"/.exec(readFileSync(join(dir, "index.html"), "utf8"))![1];
        existe = existsSync(join(dir, src));
        writeFileSync(salida, "mp4");
      },
    }))({ ...tarea(clip), proyectoId: otro }, ctx());
    expect(src).not.toMatch(/[#?%]/);
    expect(existe).toBe(true);
    expect(existsSync(raro)).toBe(true);
  });

  test("si Windows tiene ocupada la carpeta temporal (EBUSY) la exportación igual termina bien", async () => {
    let intentos = 0;
    const ocupado = async () => { intentos++; throw Object.assign(new Error("EBUSY: resource busy or locked, rmdir"), { code: "EBUSY" }); };
    await crearEjecutorExportar(deps({ borrar: ocupado }))(tarea(clip), ctx());
    expect(readdirSync(join(carpetaProyecto(id), "exportados"))).toContain("el-quebrantamiento-9x16.mp4");
    expect((await leerJson<ClipSpec[]>(id, "clips.json"))?.[0].estado).toBe("exportado");
    expect(intentos).toBeGreaterThan(1);
  });

  test("el logo de la marca viaja a la carpeta del reel y el cierre lo usa", async () => {
    const { copiarLogo, guardarMarca, leerMarca } = await import("../../../src/main/proyectos/almacen");
    const origen = join(mkdtempSync(join(tmpdir(), "logo-")), "logo.png");
    writeFileSync(origen, "png");
    await guardarMarca({ ...(await leerMarca()), logo: await copiarLogo(origen) });
    let html = "", hayLogo = false;
    await crearEjecutorExportar(deps({
      renderizar: async (dir, salida) => {
        html = readFileSync(join(dir, "index.html"), "utf8");
        hayLogo = existsSync(join(dir, "recursos", "logo.png"));
        writeFileSync(salida, "mp4");
      },
    }))(tarea(clip), ctx());
    expect(html).toContain('<img src="recursos/logo.png"');
    expect(hayLogo).toBe(true);
  });

  test("la voz limpia del proyecto va a la carpeta del reel (se crea si el proyecto es de antes) y el MP4 se normaliza", async () => {
    let html = "", hayVoz = false;
    await crearEjecutorExportar(deps({
      renderizar: async (dir, salida) => {
        html = readFileSync(join(dir, "index.html"), "utf8");
        hayVoz = existsSync(join(dir, "voz.m4a"));
        writeFileSync(salida, "mp4");
      },
    }))(tarea(clip), ctx());
    expect(vocesCreadas).toEqual([join(carpetaProyecto(id), "voz.m4a")]);
    expect(hayVoz).toBe(true);
    expect(html).toContain('class="clip voz" src="voz.m4a"');
    expect(normalizados).toEqual([join(carpetaProyecto(id), "exportados", "el-quebrantamiento-9x16.mp4")]);
    // Segunda exportación: la voz ya existe, no se vuelve a crear.
    await crearEjecutorExportar(deps())({ ...tarea(clip), id: "t2" }, ctx());
    expect(vocesCreadas).toHaveLength(1);
  });

  test("la música elegida se copia a la carpeta del reel y se mezcla", async () => {
    const pista = join(mkdtempSync(join(tmpdir(), "pista-")), "Alabanza #1.mp3");
    writeFileSync(pista, "mp3");
    let html = "", hayMusica = false;
    await crearEjecutorExportar(deps({
      musica: async () => pista,
      renderizar: async (dir, salida) => {
        html = readFileSync(join(dir, "index.html"), "utf8");
        hayMusica = existsSync(join(dir, "musica.mp3"));
        writeFileSync(salida, "mp4");
      },
    }))(tarea(clip), ctx());
    expect(hayMusica).toBe(true);
    expect(html).toContain('<audio id="musica" class="clip" src="musica.mp3"');
  });

  test("junto al MP4 quedan la portada (con el gancho visible) y los textos para cada red", async () => {
    const c = { ...clip, redes: { instagram: { texto: "Texto IG", hashtags: ["#fe"] }, tiktok: { texto: "Texto TT", hashtags: [] }, facebook: { texto: "Texto FB" }, youtube: { titulo: "Título YT", texto: "Texto YT" } } };
    await crearEjecutorExportar(deps())(tarea(c), ctx());
    const dir = join(carpetaProyecto(id), "exportados");
    expect(readdirSync(dir).sort()).toEqual(["el-quebrantamiento-9x16-portada.jpg", "el-quebrantamiento-9x16.mp4", "el-quebrantamiento-textos.txt"]);
    expect(portadas[0]).toBeGreaterThan(0.5);
    expect(portadas[0]).toBeLessThanOrEqual(1.2);
    const textos = readFileSync(join(dir, "el-quebrantamiento-textos.txt"), "utf8");
    for (const t of ["Instagram", "TikTok", "Facebook", "YouTube Shorts", "Texto IG", "#fe", "Título YT"]) expect(textos).toContain(t);
  });

  test("menor: si no se puede crear la música, el reel se exporta igual, sin música", async () => {
    let html = "";
    await crearEjecutorExportar(deps({
      musica: async () => { throw new Error("No se pudo crear la música de fondo (pad)."); },
      renderizar: async (dir, salida) => { html = readFileSync(join(dir, "index.html"), "utf8"); writeFileSync(salida, "mp4"); },
    }))(tarea(clip), ctx());
    expect(html).not.toContain('id="musica"');
  });

  test("sin GPU NVIDIA exporta sin --gpu", async () => {
    await crearEjecutorExportar(deps({ gpu: async () => false }))(tarea(clip), ctx());
    expect(llamadas[0].gpu).toBe(false);
  });

  test("video original movido: error en español", async () => {
    renameSync(video, video + ".movido");
    await expect(crearEjecutorExportar(deps())(tarea(clip), ctx())).rejects.toThrow(
      "No encuentro el video original. Vuelve a ponerlo en su lugar y reintenta.",
    );
  });

  test("un versículo activo sin confirmar no se exporta", async () => {
    const c = { ...clip, versiculos: [{ ref: "Salmos 51:17", texto: "Los sacrificios…", en: 3, activo: true, confirmado: false }] };
    await expect(crearEjecutorExportar(deps())(tarea(c), ctx())).rejects.toThrow("Confirma el texto de Salmos 51:17 antes de exportar.");
    expect(llamadas).toEqual([]);
  });
});

test("revisión I3: la voz limpia se escribe en un temporal y solo queda como voz.m4a si FFmpeg terminó bien", async () => {
  const { crearVozSegura } = await import("../../../src/main/exportar/tarea");
  const dir = mkdtempSync(join(tmpdir(), "voz-"));
  const destino = join(dir, "voz.m4a");
  await expect(crearVozSegura(destino, async (tmp) => { writeFileSync(tmp, "medio"); return 1; })).rejects.toThrow();
  expect(existsSync(destino)).toBe(false);
  await crearVozSegura(destino, async (tmp) => { writeFileSync(tmp, "completa"); return 0; });
  expect(readFileSync(destino, "utf8")).toBe("completa");
});

test("menor: dos clips con el mismo título no se pisan el archivo de textos", async () => {
  const { textosNombre } = await import("../../../src/main/exportar/tarea");
  expect(textosNombre("fe-9x16.mp4")).toBe("fe-textos.txt");
  expect(textosNombre("fe-4x5.mp4")).toBe("fe-textos.txt");
  expect(textosNombre("fe-2-9x16.mp4")).toBe("fe-2-textos.txt");
});

test("plan 5: el reel exportado usa la transcripción corregida", async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-exp-"));
  const video = join(mkdtempSync(join(tmpdir(), "reels-v-")), "culto.mp4");
  writeFileSync(video, "x");
  const id = (await crearProyecto({ nombre: "Culto", video: { ruta: video, tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
  await guardarJson(id, "transcripcion.json", JSON.parse(readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8")));
  const { corregir } = await import("../../../src/main/proyectos/almacen");
  await corregir(id, { de: "quebrantamiento", a: "QUEBRANTO" });
  const clip: ClipSpec = {
    id: "c1", titulo: "T", gancho: "", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46,
    apertura: null, palabrasClave: [], versiculos: [], puntaje: 90, razon: "", descripcion: "", hashtags: [],
    encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
    ...PLAN3, musica: SIN_MUSICA, cierre: false, formatos: ["9:16"], estado: "sugerido",
  };
  await guardarJson(id, "clips.json", [clip]);
  let html = "";
  await crearEjecutorExportar({
    gpu: async () => false, normalizar: async () => {}, musica: async () => null, portada: async (_m, _t, s) => writeFileSync(s, "j"),
    crearVoz: async (_p, d) => writeFileSync(d, "m"), dimensiones: async () => ({ ancho: 1280, alto: 720 }),
    renderizar: async (dir, salida) => { html = readFileSync(join(dir, "index.html"), "utf8"); writeFileSync(salida, "mp4"); },
  })({ id: "t1", proyectoId: id, tipo: "exportar", estado: "corriendo", pct: 0, creada: "", clipId: "c1", formato: "9:16", instantanea: clip }, ctx());
  expect(html).toContain("QUEBRANTO");
  expect(html).not.toMatch(/>quebrantamiento</i);
});

test("plan 5: un clip con voz Podcast crea voz-podcast.m4a una sola vez; sin nivel usa voz.m4a", async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-exp-"));
  const video = join(mkdtempSync(join(tmpdir(), "reels-v-")), "culto.mp4");
  writeFileSync(video, "x");
  const id = (await crearProyecto({ nombre: "Culto", video: { ruta: video, tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 75 } })).id;
  await guardarJson(id, "transcripcion.json", JSON.parse(readFileSync(join(FIX, "transcripcion-muestra.json"), "utf8")));
  const base: ClipSpec = {
    id: "c1", titulo: "T", gancho: "", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46,
    apertura: null, palabrasClave: [], versiculos: [], puntaje: 90, razon: "", descripcion: "", hashtags: [],
    encuadre: { modo: "fijo", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
    ...PLAN3, musica: SIN_MUSICA, cierre: false, formatos: ["9:16"], estado: "sugerido",
  };
  await guardarJson(id, "clips.json", [base]);
  const creadas: [string, string][] = [];
  const ejecutor = crearEjecutorExportar({
    gpu: async () => false, normalizar: async () => {}, musica: async () => null, portada: async (_m, _t, s) => writeFileSync(s, "j"),
    crearVoz: async (_p, d, _s, nivel) => { creadas.push([basename(d), nivel ?? "limpia"]); writeFileSync(d, "m"); },
    dimensiones: async () => ({ ancho: 1280, alto: 720 }),
    renderizar: async (dir, salida) => { expect(existsSync(join(dir, "voz.m4a"))).toBe(true); writeFileSync(salida, "mp4"); },
  });
  const tarea = (c: ClipSpec): Tarea => ({ id: `t-${Math.random()}`, proyectoId: id, tipo: "exportar", estado: "corriendo", pct: 0, creada: "", clipId: c.id, formato: "9:16", instantanea: c });
  await ejecutor(tarea(base), ctx());
  await ejecutor(tarea({ ...base, voz: "podcast" }), ctx());
  await ejecutor(tarea({ ...base, voz: "podcast" }), ctx());
  expect(creadas).toEqual([["voz.m4a", "limpia"], ["voz-podcast.m4a", "podcast"]]);
});

test("plan 5: la carpeta del render lleva los efectos de sonido y la composición los usa", async () => {
  const { archivosRecursos } = await import("../../../src/main/exportar/preparar");
  const r = archivosRecursos();
  for (const n of ["whoosh", "whoosh-suave", "pop"]) {
    expect(r[`recursos/efectos/${n}.wav`]).toBeTruthy();
    expect(existsSync(r[`recursos/efectos/${n}.wav`])).toBe(true);
  }
});
