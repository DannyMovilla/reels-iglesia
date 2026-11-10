import { expect, test, vi } from "vitest";
import { alCambiar, enCurso, lanzar } from "../../src/renderer/enCurso";

/** Una promesa que se resuelve o rechaza desde afuera. */
function manual<T>() {
  let resolver!: (v: T) => void, rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((r, x) => { resolver = r; rechazar = x; });
  return { promesa, resolver, rechazar };
}

test("lanzar dos veces con la misma clave corre f una sola vez", async () => {
  const m = manual<number>();
  const f = vi.fn(() => m.promesa);
  const a = lanzar("uno", f);
  const b = lanzar("uno", f);
  expect(f).toHaveBeenCalledTimes(1);
  expect(a).toBe(b);
  m.resolver(5);
  await expect(a).resolves.toBe(5);
});

test("enCurso guarda el último progreso y se borra al terminar", async () => {
  const m = manual<string>();
  const p = lanzar("dos", async (alProgreso) => { alProgreso("parte 1"); return m.promesa; });
  await Promise.resolve();
  expect(enCurso("dos")?.progreso).toBe("parte 1");
  m.resolver("listo");
  await p;
  expect(enCurso("dos")).toBeUndefined();
});

test("alCambiar avisa el progreso y el final; también si f falla", async () => {
  const m = manual<void>();
  const vistos: (string | null)[] = [];
  const p = lanzar("tres", async (alProgreso) => { await Promise.resolve(); alProgreso("a"); return m.promesa; });
  const quitar = alCambiar("tres", (x) => vistos.push(x));
  await Promise.resolve(); await Promise.resolve();
  m.rechazar(new Error("mal"));
  await expect(p).rejects.toThrow("mal");
  expect(vistos).toEqual(["a", null]);
  expect(enCurso("tres")).toBeUndefined();
  quitar();
});
