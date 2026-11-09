import { expect, test } from "vitest";
import { clipManual, conservarAlReanalizar, ESTILO_POR_DEFECTO } from "../../src/shared/clip";
import { filtrarClips, FILTRO_INICIAL } from "../../src/shared/filtro-clips";
import type { ClipSpec } from "../../src/shared/tipos";
import { PLAN3 } from "../ayuda/plan3";

const c = (id: string, extra: Partial<ClipSpec> = {}): ClipSpec => ({
  id, titulo: id, gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 0, fin: 45, apertura: null, palabrasClave: [],
  versiculos: [], puntaje: 50, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3, cierre: true, formatos: ["9:16"], estado: "sugerido", ...extra,
});
const clips = [
  c("corto", { inicio: 100, fin: 120, puntaje: 70, categoria: "Llamado" }),
  c("medio", { inicio: 10, fin: 55, puntaje: 90, gancho: "La Fe que mueve", favorito: true }),
  c("largo", { inicio: 300, fin: 380, puntaje: 60, versiculos: [{ ref: "Juan 3:16", texto: "", en: 1, activo: true, confirmado: false }] }),
  c("oculto", { inicio: 200, fin: 230, puntaje: 99, oculto: true }),
];
const ids = (r: ClipSpec[]) => r.map((x) => x.id);

test("por defecto: mayor impacto primero y sin los ocultos", () => {
  expect(ids(filtrarClips(clips, FILTRO_INICIAL))).toEqual(["medio", "corto", "largo"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, ocultos: true }))).toEqual(["oculto", "medio", "corto", "largo"]);
});

test("orden en el video, más cortos y más largos", () => {
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, orden: "video" }))).toEqual(["medio", "corto", "largo"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, orden: "cortos" }))).toEqual(["corto", "medio", "largo"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, orden: "largos" }))).toEqual(["largo", "medio", "corto"]);
});

test("filtros: categoría, duración, puntaje, versículo y favoritos", () => {
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, categorias: ["Llamado"] }))).toEqual(["corto"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, duracion: "corta" }))).toEqual(["corto"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, duracion: "media" }))).toEqual(["medio"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, duracion: "larga" }))).toEqual(["largo"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, puntajeMinimo: 65 }))).toEqual(["medio", "corto"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, conVersiculo: true }))).toEqual(["largo"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, favoritos: true }))).toEqual(["medio"]);
});

test("buscar sin tildes ni mayúsculas en título, gancho y lo que se dice", () => {
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, texto: "fé" }))).toEqual(["medio"]);
  expect(ids(filtrarClips(clips, { ...FILTRO_INICIAL, texto: "ANSIEDAD" }, (x) => (x.id === "largo" ? "no tengas ansiedad" : "")))).toEqual(["largo"]);
});

test("clip a mano: se ajusta a palabras, dura al menos 5 s y se marca manual", () => {
  const w = (s: number, e: number, t: string) => ({ s, e, t });
  const ps = [w(10, 10.5, "Dios"), w(10.6, 11, "es"), w(11.1, 12, "fiel"), w(12.1, 13, "y"), w(13.1, 14, "bueno"), w(14.1, 15, "siempre"), w(15.1, 16, "con"), w(16.1, 17, "nosotros.")];
  const m = clipManual(10.2, 12.9, ps, ESTILO_POR_DEFECTO);
  expect(m.inicio).toBe(10);
  expect(m.fin - m.inicio).toBeGreaterThanOrEqual(5);
  expect(m).toMatchObject({ origen: "manual", estado: "editado", categoria: "Enseñanza", puntaje: 0, gancho: "", titulo: "Dios es fiel y bueno siempre" });
  expect(m.cortes).toEqual(ESTILO_POR_DEFECTO.cortes);
  expect(m.id).toBeTruthy();
});

test("volver a analizar conserva favoritos, clips a mano, editados y exportados", () => {
  const viejos = [c("s1"), c("fav", { favorito: true }), c("man", { origen: "manual", estado: "editado" }), c("ed", { estado: "editado" }), c("ex", { estado: "exportado" })];
  const nuevos = [c("n1"), c("n2")];
  expect(ids(conservarAlReanalizar(viejos, nuevos))).toEqual(["fav", "man", "ed", "ex", "n1", "n2"]);
});
