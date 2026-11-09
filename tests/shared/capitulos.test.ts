import { expect, test } from "vitest";
import { limpiarCapitulos, textoYoutube } from "../../src/shared/capitulos";

test("limpiar: ordena, el primero en 0:00, quita los de menos de 10 s y los que pasan del final", () => {
  const r = limpiarCapitulos([{ t: 300, titulo: "Llamado" }, { t: 4, titulo: "Lectura" }, { t: 120, titulo: "La fe" }, { t: 125, titulo: "Casi igual" }, { t: 9999, titulo: "Fuera" }], 900);
  expect(r).toEqual([{ t: 0, titulo: "Lectura" }, { t: 120, titulo: "La fe" }, { t: 300, titulo: "Llamado" }]);
});

test("menos de 3 capítulos: error en español", () => {
  expect(() => limpiarCapitulos([{ t: 0, titulo: "A" }, { t: 5, titulo: "B" }, { t: 20, titulo: "C" }], 100)).toThrow("Claude no encontró al menos 3 partes en la prédica.");
});

const caps = { resumen: "El pastor habló de la fe en la prueba.", capitulos: [{ t: 0, titulo: "Lectura: Filipenses 4" }, { t: 125, titulo: "No te afanes" }, { t: 2410, titulo: "Llamado y oración" }] };

test("solo la prédica: M:SS o H:MM:SS según la duración", () => {
  expect(textoYoutube(caps, { completo: false, inicioRango: 6284 })).toBe("El pastor habló de la fe en la prueba.\n\n0:00 Lectura: Filipenses 4\n2:05 No te afanes\n40:10 Llamado y oración");
});

test("video completo: «Inicio del culto» en 0:00 y los demás sumando el inicio de la prédica", () => {
  expect(textoYoutube(caps, { completo: true, inicioRango: 6284 })).toBe(
    "El pastor habló de la fe en la prueba.\n\n0:00:00 Inicio del culto\n1:44:44 Lectura: Filipenses 4\n1:46:49 No te afanes\n2:24:54 Llamado y oración");
  // Si la prédica empieza en 0, no hace falta la línea extra.
  expect(textoYoutube(caps, { completo: true, inicioRango: 0 }).split("\n")[2]).toBe("0:00 Lectura: Filipenses 4");
});
