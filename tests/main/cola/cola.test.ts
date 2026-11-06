import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Cola, type Ejecutor, type Tarea } from "../../../src/main/cola/cola";

const archivo = () => join(mkdtempSync(join(tmpdir(), "reels-cola-")), "cola.json");
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hastaQue = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("tiempo agotado");
    await espera(10);
  }
};
const ok: Ejecutor = async (_t, ctx) => { ctx.alProgreso(50); await espera(20); };

test("corre las tareas en orden de llegada y termina en ok", async () => {
  const orden: string[] = [];
  const cola = new Cola(archivo(), {
    transcribir: async (t) => { orden.push(t.tipo); await espera(20); },
    caras: async (t) => { orden.push(t.tipo); },
    analizar: ok,
    exportar: ok,
  });
  await cola.cargar();
  const a = cola.agregar("p1", "transcribir");
  const b = cola.agregar("p1", "caras");
  await hastaQue(() => cola.lista().every((t) => t.estado === "ok"));
  expect(orden).toEqual(["transcribir", "caras"]);
  expect(cola.lista().map((t) => t.id)).toEqual([a.id, b.id]);
});

test("un error deja la tarea en error con su mensaje y la siguiente igual corre", async () => {
  const cola = new Cola(archivo(), {
    transcribir: async () => { throw new Error("sin GPU"); },
    caras: ok,
    analizar: ok,
    exportar: ok,
  });
  await cola.cargar();
  const a = cola.agregar("p1", "transcribir");
  const b = cola.agregar("p1", "caras");
  await hastaQue(() => cola.lista().find((t) => t.id === b.id)?.estado === "ok");
  const ta = cola.lista().find((t) => t.id === a.id)!;
  expect(ta.estado).toBe("error");
  expect(ta.error).toBe("sin GPU");
});

test("cancelar aborta la señal y deja la tarea cancelada", async () => {
  let abortada = false;
  const cola = new Cola(archivo(), {
    transcribir: (_t, ctx) => new Promise((_res, rej) => {
      ctx.senal.addEventListener("abort", () => { abortada = true; rej(new Error("abortada")); });
    }),
    caras: ok,
    analizar: ok,
    exportar: ok,
  });
  await cola.cargar();
  const a = cola.agregar("p1", "transcribir");
  await hastaQue(() => cola.lista()[0].estado === "corriendo");
  cola.cancelar(a.id);
  await hastaQue(() => cola.lista()[0].estado === "cancelada");
  expect(abortada).toBe(true);
});

test("una tarea que estaba corriendo al cerrar la app queda interrumpida y se puede reintentar", async () => {
  const ruta = archivo();
  const vieja: Tarea = { id: "t1", proyectoId: "p1", tipo: "transcribir", estado: "corriendo", pct: 40, creada: "2026-11-05T10:00:00.000Z" };
  writeFileSync(ruta, JSON.stringify([vieja]));
  const cola = new Cola(ruta, { transcribir: ok, caras: ok, analizar: ok, exportar: ok });
  await cola.cargar();
  expect(cola.lista()[0].estado).toBe("interrumpida");
  cola.reintentar("t1");
  await hastaQue(() => cola.lista()[0].estado === "ok");
});

test("un cola.json dañado no impide abrir la app: se respalda y la cola empieza vacía", async () => {
  const ruta = archivo();
  writeFileSync(ruta, "");
  const cola = new Cola(ruta, { transcribir: ok, caras: ok, analizar: ok, exportar: ok });
  await cola.cargar();
  expect(cola.lista()).toEqual([]);
  expect(existsSync(ruta + ".bad")).toBe(true);
});
