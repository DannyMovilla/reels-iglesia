import { existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
});

describe("ejecutor exportar", () => {
  let id: string;
  let video: string;
  let clip: ClipSpec;
  let llamadas: { gpu: boolean; html: string; salida: string }[];

  let normalizados: string[];
  let vocesCreadas: string[];
  const deps = (extra: Partial<DepsExportar> = {}): DepsExportar => ({
    gpu: async () => true,
    normalizar: async (mp4) => { normalizados.push(mp4); },
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
    expect(readdirSync(join(carpetaProyecto(id), "exportados"))).toEqual(["el-quebrantamiento-9x16.mp4"]);
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
    expect(readdirSync(join(carpetaProyecto(id), "exportados"))).toEqual(["el-quebrantamiento-9x16.mp4"]);
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
