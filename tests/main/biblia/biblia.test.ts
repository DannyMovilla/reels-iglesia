import { expect, test } from "vitest";
import { formatearReferencia, parsearReferencia } from "../../../src/main/biblia/biblia";

test("reconoce Salmo y Salmos", () => {
  expect(parsearReferencia("Salmo 51:17")).toEqual({ libro: "Salmos", capitulo: 51, desde: 17, hasta: 17 });
  expect(parsearReferencia("Salmos 51:17")).toEqual({ libro: "Salmos", capitulo: 51, desde: 17, hasta: 17 });
});

test("reconoce rangos, números, abreviaturas, coma y 'San'", () => {
  expect(parsearReferencia("1 Corintios 13:4-7")).toEqual({ libro: "1 Corintios", capitulo: 13, desde: 4, hasta: 7 });
  expect(parsearReferencia("1 Co 13:4")).toEqual({ libro: "1 Corintios", capitulo: 13, desde: 4, hasta: 4 });
  expect(parsearReferencia("Romanos 8,28")).toEqual({ libro: "Romanos", capitulo: 8, desde: 28, hasta: 28 });
  expect(parsearReferencia("San Juan 3:16")).toEqual({ libro: "Juan", capitulo: 3, desde: 16, hasta: 16 });
  expect(parsearReferencia("Primera de Juan 4:8")).toEqual({ libro: "1 Juan", capitulo: 4, desde: 8, hasta: 8 });
});

test("rechaza lo que no es una referencia", () => {
  expect(parsearReferencia("Hola 1:1")).toBeNull();
  expect(parsearReferencia("Juan")).toBeNull();
});

test("formatea la referencia con el nombre canónico del libro", () => {
  expect(formatearReferencia("Salmo 51:17")).toBe("Salmos 51:17");
  expect(formatearReferencia("1 Co 13:4-7")).toBe("1 Corintios 13:4-7");
  expect(formatearReferencia("San Juan 3:16")).toBe("Juan 3:16");
  expect(formatearReferencia("Hola 1:1")).toBe("Hola 1:1");
});
