import { expect, test } from "vitest";
import { bloquesSrt, leerSrt, textoSrt } from "../../src/shared/srt";
import type { Palabra } from "../../src/shared/reel/tiempo";

const w = (s: number, e: number, t: string): Palabra => ({ s, e, t });

/** 1 h 10 min de "prédica": frases de 6 a 14 palabras con pausas. */
function largo(): Palabra[] {
  const ps: Palabra[] = [];
  const voc = ["Dios", "nos", "ama", "con", "un", "amor", "eterno", "y", "fiel", "hermanos", "la", "gracia", "es", "suficiente", "misericordia"];
  let t = 0, k = 0;
  while (t < 4200) {
    const n = 6 + (k % 9);
    for (let i = 0; i < n; i++) {
      const palabra = voc[(k * 7 + i) % voc.length] + (i === n - 1 ? (k % 3 === 0 ? "." : ",") : "");
      ps.push(w(t, t + 0.3, palabra));
      t += 0.38;
    }
    t += 0.6 + (k % 4) * 0.3;
    k++;
  }
  return ps;
}

test("en una prédica de 1 h 10 min ningún bloque rompe las reglas de lectura", () => {
  const b = bloquesSrt(largo());
  expect(b.length).toBeGreaterThan(500);
  for (let i = 0; i < b.length; i++) {
    const lineas = b[i].texto.split("\n");
    expect(lineas.length).toBeLessThanOrEqual(2);
    for (const l of lineas) expect(l.length).toBeLessThanOrEqual(42);
    expect(b[i].texto.trim()).not.toBe("");
    const dur = b[i].hasta - b[i].desde;
    expect(dur).toBeLessThanOrEqual(7.001);
    expect(dur).toBeGreaterThanOrEqual(0.999);
    expect(b[i].texto.replace("\n", " ").length / dur).toBeLessThanOrEqual(17.5);
    if (i > 0) expect(b[i].desde).toBeGreaterThanOrEqual(b[i - 1].hasta);
  }
});

test("corta en el punto cuando puede", () => {
  const ps = [w(0, 0.4, "Dios"), w(0.5, 0.9, "es"), w(1, 1.6, "fiel."), w(2.2, 2.6, "Él"), w(2.7, 3.1, "nunca"), w(3.2, 3.9, "falla.")];
  expect(bloquesSrt(ps).map((b) => b.texto)).toEqual(["Dios es fiel.", "Él nunca falla."]);
});

test("formato SRT exacto, con desplazamiento, y se puede volver a leer", () => {
  const b = [{ desde: 1.5, hasta: 3.25, texto: "Dios es fiel." }, { desde: 3725.04, hasta: 3728, texto: "Primera línea\nsegunda línea" }];
  expect(textoSrt(b)).toBe("1\n00:00:01,500 --> 00:00:03,250\nDios es fiel.\n\n2\n01:02:05,040 --> 01:02:08,000\nPrimera línea\nsegunda línea\n");
  expect(textoSrt(b, 6284).split("\n")[1]).toBe("01:44:45,500 --> 01:44:47,250");
  expect(leerSrt(textoSrt(b))).toEqual(b);
  expect(leerSrt(textoSrt(b).replace(/\n/g, "\r\n"))).toEqual(b);
});
