import { existsSync, mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { borrarProyecto, borrarReels, dentroDeDatos, resumenBorrado } from "../../../src/main/datos/borrar";
import { crearProyecto, guardarJson, leerClips } from "../../../src/main/proyectos/almacen";
import { carpetaCreacion, guardarCreacion, leerCreacion } from "../../../src/main/ia/almacen";
import { carpetaProyecto } from "../../../src/main/rutas";
import type { ClipSpec, Creacion } from "../../../src/shared/tipos";
import { PLAN3 } from "../../ayuda/plan3";

let id: string;
let video: string;
let papelera: string;
const aPapelera = async (ruta: string) => { renameSync(ruta, join(papelera, `${Date.now()}-${basename(ruta)}`)); };
const libre = { papelera: aPapelera, ocupado: () => false };

const clip = (extra: Partial<ClipSpec>): ClipSpec => ({
  id: "c1", titulo: "Fe", gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 1, fin: 20, apertura: null,
  palabrasClave: [], versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3, cierre: false, formatos: ["9:16", "4:5"],
  estado: "exportado", ...extra,
});

beforeEach(async () => {
  process.env.REELS_IGLESIA_DATOS = mkdtempSync(join(tmpdir(), "reels-borrar-"));
  papelera = mkdtempSync(join(tmpdir(), "reels-papelera-"));
  video = join(mkdtempSync(join(tmpdir(), "reels-v-")), "culto.mp4");
  writeFileSync(video, "x");
  id = (await crearProyecto({ nombre: "Culto", video: { ruta: video, tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 50 } })).id;
  const exp = join(carpetaProyecto(id), "exportados");
  mkdirSync(exp, { recursive: true });
  for (const f of ["fe-9x16.mp4", "fe-4x5.mp4"]) writeFileSync(join(exp, f), "m".repeat(1000));
  writeFileSync(join(exp, "fe-9x16-portada.jpg"), "j".repeat(100));
  writeFileSync(join(exp, "fe-textos.txt"), "textos");
  await guardarJson(id, "clips.json", [clip({}), clip({ id: "c2", titulo: "Gracia", estado: "editado" })]);
});

test("el resumen cuenta clips, reels y bytes", async () => {
  const r = await resumenBorrado(id);
  expect(r.clips).toBe(2);
  expect(r.reels).toBe(2);
  expect(r.bytes).toBeGreaterThan(2000);
});

test("borrar una prédica la manda entera a la Papelera y no toca el video original", async () => {
  await borrarProyecto(id, libre);
  expect(existsSync(carpetaProyecto(id))).toBe(false);
  expect(existsSync(video)).toBe(true);
});

test("una prédica trabajando no se borra", async () => {
  await expect(borrarProyecto(id, { papelera: aPapelera, ocupado: () => true })).rejects.toThrow("Espera a que termine lo que está haciendo esta prédica.");
  expect(existsSync(carpetaProyecto(id))).toBe(true);
});

test("si la Papelera falla, la prédica queda completa (Review Focus 4)", async () => {
  const falla = async () => { throw new Error("EBUSY"); };
  await expect(borrarProyecto(id, { papelera: falla, ocupado: () => false }))
    .rejects.toThrow("No pude mandar la prédica a la Papelera. Cierra los programas que tengan abiertos sus archivos y prueba de nuevo.");
  expect(existsSync(join(carpetaProyecto(id), "exportados", "fe-9x16.mp4"))).toBe(true);
});

test("ids y nombres con rutas se rechazan", async () => {
  await expect(borrarProyecto("../x", libre)).rejects.toThrow("Proyecto no válido.");
  await expect(borrarReels(id, ["../a.mp4"], libre)).rejects.toThrow("Archivo no válido.");
  expect(dentroDeDatos(join(process.env.REELS_IGLESIA_DATOS!, "proyectos", "x"))).toBe(true);
  expect(dentroDeDatos(tmpdir())).toBe(false);
});

test("borrar un reel: se va con su portada; los textos y el clip quedan mientras haya otro formato", async () => {
  const exp = join(carpetaProyecto(id), "exportados");
  const r = await borrarReels(id, ["fe-9x16.mp4"], libre);
  expect(r.bytes).toBe(1100);
  expect(existsSync(join(exp, "fe-9x16.mp4"))).toBe(false);
  expect(existsSync(join(exp, "fe-9x16-portada.jpg"))).toBe(false);
  expect(existsSync(join(exp, "fe-textos.txt"))).toBe(true);
  expect((await leerClips(id)).find((c) => c.id === "c1")!.estado).toBe("exportado");
  await borrarReels(id, ["fe-4x5.mp4"], libre);
  expect(existsSync(join(exp, "fe-textos.txt"))).toBe(false);
  expect((await leerClips(id)).find((c) => c.id === "c1")!.estado).toBe("editado");
});

test("«todos» borra todos los reels; un clip con la lista de sus reels la usa", async () => {
  await guardarJson(id, "clips.json", [clip({ titulo: "Otro título", exportados: ["fe-9x16.mp4", "fe-4x5.mp4"] })]);
  await borrarReels(id, "todos", libre);
  expect((await leerClips(id))[0].estado).toBe("editado");
  expect((await leerClips(id))[0].exportados).toEqual([]);
});

test("Con IA: sin reels, la creación vuelve a borrador", async () => {
  const c = { id: "c9", creado: "", entrada: { tipo: "tema", texto: "fe" }, versiculo: { ref: "", texto: "", confirmado: true }, gancho: "", reflexion: "",
    palabrasClave: [], musica: PLAN3.musica, subtitulos: { estilo: "pop" }, fondo: { tipo: "degradado" }, redes: PLAN3.redes, formatos: ["9:16"], estado: "exportado" } as unknown as Creacion;
  mkdirSync(join(carpetaCreacion("c9"), "exportados"), { recursive: true });
  await guardarCreacion(c);
  writeFileSync(join(carpetaCreacion("c9"), "exportados", "fe-9x16.mp4"), "m");
  await borrarReels("ia:c9", "todos", libre);
  expect((await leerCreacion("c9")).estado).toBe("borrador");
});
