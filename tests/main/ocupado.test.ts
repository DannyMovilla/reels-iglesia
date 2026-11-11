import { expect, test } from "vitest";
import { crearOcupado } from "../../src/main/ocupado";
import type { Tarea } from "../../src/shared/tipos";

const tarea = (proyectoId: string, estado: Tarea["estado"]): Tarea => ({ id: `${proyectoId}-${estado}`, proyectoId, tipo: "exportar", estado, pct: 0, creada: "" });

test("una tarea pendiente o corriendo ocupa su prédica; una terminada no", () => {
  const o = crearOcupado({ tareas: () => [tarea("p1", "corriendo"), tarea("p2", "ok"), tarea("p3", "pendiente"), tarea("p4", "error")], entregas: () => [] });
  expect(o.proyectoOcupado("p1")).toBe(true);
  expect(o.proyectoOcupado("p2")).toBe(false);
  expect(o.proyectoOcupado("p3")).toBe(true);
  expect(o.proyectoOcupado("p4")).toBe(false);
  expect(o.hayTrabajo()).toBe(true);
});

test("una traducción o frases en curso ocupan su prédica", () => {
  const o = crearOcupado({ tareas: () => [], entregas: () => ["p2"] });
  expect(o.proyectoOcupado("p2")).toBe(true);
  expect(o.hayTrabajo()).toBe(true);
});

test("las tareas de Con IA cuentan con su id ia:<id>", () => {
  const o = crearOcupado({ tareas: () => [tarea("ia:c1", "corriendo")], entregas: () => [] });
  expect(o.proyectoOcupado("ia:c1")).toBe(true);
  expect(o.hayTrabajo()).toBe(true);
});

test("sin nada en curso", () => {
  const o = crearOcupado({ tareas: () => [tarea("p1", "ok")], entregas: () => [] });
  expect(o.hayTrabajo()).toBe(false);
});

test("revisión: el trabajo fuera de la cola (MP3, imágenes, voces) ocupa su prédica mientras dura, aunque falle", async () => {
  const { conTrabajo, trabajosEnCurso } = await import("../../src/main/ocupado");
  let dentro: string[] = [];
  await conTrabajo("p7", async () => { dentro = trabajosEnCurso(); });
  expect(dentro).toEqual(["p7"]);
  expect(trabajosEnCurso()).toEqual([]);
  await expect(conTrabajo("p8", async () => { throw new Error("falló"); })).rejects.toThrow("falló");
  expect(trabajosEnCurso()).toEqual([]);
});
