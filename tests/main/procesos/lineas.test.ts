import { expect, test } from "vitest";
import { ejecutarConProgreso } from "../../../src/main/procesos/lineas";

test("separa las líneas de progreso JSON del resto de la salida", async () => {
  const progresos: unknown[] = [];
  const script = 'console.log(JSON.stringify({etapa:"x",pct:50})); console.log("hola")';
  const r = await ejecutarConProgreso("node", ["-e", script], { alProgreso: (p) => progresos.push(p) });
  expect(r.codigo).toBe(0);
  expect(progresos).toEqual([{ etapa: "x", pct: 50 }]);
  expect(r.stdout.replace(/\r/g, "")).toBe("hola\n");
});

test("abortar mata el proceso", async () => {
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), 100);
  const t0 = Date.now();
  const r = await ejecutarConProgreso("node", ["-e", "setInterval(() => {}, 1000)"], { senal: ctl.signal });
  expect(r.codigo).not.toBe(0);
  expect(Date.now() - t0).toBeLessThan(2000);
});
