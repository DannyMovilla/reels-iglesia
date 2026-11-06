import { expect, test } from "vitest";
import { AvisadorExportaciones } from "../../../src/main/exportar/avisos";
import type { Tarea } from "../../../src/shared/tipos";

const t = (id: string, proyectoId: string, estado: Tarea["estado"], tipo: Tarea["tipo"] = "exportar"): Tarea =>
  ({ id, proyectoId, tipo, estado, pct: 0, creada: "" });

test("avisa una vez cuando termina la tanda de un proyecto, contando solo esa tanda", () => {
  const a = new AvisadorExportaciones();
  // exportaciones viejas ya terminadas no cuentan
  expect(a.cambio([t("viejo", "p1", "ok"), t("a", "p1", "corriendo"), t("b", "p1", "pendiente"), t("c", "p2", "pendiente")])).toEqual([]);
  expect(a.cambio([t("viejo", "p1", "ok"), t("a", "p1", "ok"), t("b", "p1", "corriendo"), t("c", "p2", "pendiente")])).toEqual([]);
  expect(a.cambio([t("viejo", "p1", "ok"), t("a", "p1", "ok"), t("b", "p1", "error"), t("c", "p2", "corriendo")]))
    .toEqual([{ proyectoId: "p1", listos: 1, fallidos: 1 }]);
  // no repite el aviso
  expect(a.cambio([t("viejo", "p1", "ok"), t("a", "p1", "ok"), t("b", "p1", "error"), t("c", "p2", "corriendo")])).toEqual([]);
});

test("ignora las tareas que no son de exportar", () => {
  const a = new AvisadorExportaciones();
  a.cambio([t("x", "p1", "corriendo", "transcribir")]);
  expect(a.cambio([t("x", "p1", "ok", "transcribir")])).toEqual([]);
});
