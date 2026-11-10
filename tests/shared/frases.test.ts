import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { coincidencia, elegirFrases, fiel, htmlTarjetaFrase, normalizarPalabras, tamanoFrase, type Candidata, type Frase } from "../../src/shared/frases";
import { palabrasDe, type Palabra } from "../../src/shared/reel/tiempo";
import type { Marca, Transcripcion } from "../../src/shared/tipos";
import { MARCA_PLAN3 } from "../ayuda/plan3";

const muestra: Transcripcion = JSON.parse(readFileSync(join(resolve(__dirname, "../fixtures"), "transcripcion-muestra.json"), "utf8"));
const palabras = palabrasDe(muestra);
const rango = { inicio: 0, fin: 75.09 };

const A = "Y ese quebrantamiento terrenal va a activar la gloria celestial"; // 39.02
const B = "Porque cuando tú estás quebrantado, orando, aleluya, inmediatamente se va a activar la gloria celestial"; // 44.8
const C = "porque cuando hay quebrantamiento eso va a entender que hay humillación de esa persona hacia Dios"; // 54.8
const D = "por eso es importante entender que el quebrantamiento nos va a acercar a la presencia"; // 65.68
const E = "Entendiendo que esa oración, aleluya, va a traerte quebrantamiento"; // 30.93
const F = "el que ora profundamente, aleluya, tiene que sentir algo especial"; // dentro del primer segmento

test("normaliza sin tildes, mayúsculas ni puntuación y conserva la ñ", () => {
  expect(normalizarPalabras("¡Él está aquí, Señor!")).toEqual(["el", "esta", "aqui", "señor"]);
});

describe("coincidencia", () => {
  test("una frase copiada da 1, aunque cambien tildes y mayúsculas", () => {
    expect(coincidencia(A, palabras, 39)).toBe(1);
    expect(coincidencia(A.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), palabras, 39)).toBe(1);
  });
  test("con una palabra cambiada en 12 queda entre 0,9 y 0,95", () => {
    const doce = "porque cuando hay quebrantamiento eso va a entender que hay humillación grande"; // 12 palabras, la última cambiada
    const v = coincidencia(doce, palabras, 55);
    expect(v).toBeGreaterThanOrEqual(0.9);
    expect(v).toBeLessThan(0.95);
  });
  test("una inventada da poco", () => {
    expect(coincidencia("el amor de Dios nunca falla aunque el mundo se caiga", palabras, 40)).toBeLessThan(0.5);
  });
  test("la correcta con el minuto corrido 120 s no cuenta", () => {
    expect(coincidencia(A, palabras, 39 + 120)).toBeLessThan(0.9);
  });
});

describe("elegirFrases", () => {
  test("descarta inventadas, repetidas, minutos ilegibles, cortas y fuera de rango; ordena por minuto", () => {
    const cand: Candidata[] = [
      { texto: D, en: "1:05" },
      { texto: "el amor de Dios nunca falla aunque el mundo se caiga hoy", en: "0:40" },
      { texto: B, en: "0:00:45" },
      { texto: "la fe mueve montañas y abre caminos donde no hay ninguno", en: "0:50" },
      { texto: B.replace("Porque ", ""), en: "0:45" },
      { texto: A, en: "abc" },
      { texto: "gloria al Señor", en: "1:04" },
      { texto: C, en: "5:00" },
      { texto: E, en: "0:31" },
      { texto: C, en: "0:55", versiculo: { ref: "Salmos 51:17", texto: "Los sacrificios de Dios son el espíritu quebrantado" } },
    ];
    const r = elegirFrases(cand, palabras, rango);
    expect(r.map((f) => f.texto)).toEqual([E, B, C, D]);
    expect(r.every((f) => f.original === f.texto && f.fondo === "marca")).toBe(true);
    expect(r[2].versiculo).toEqual({ ref: "Salmos 51:17", texto: "Los sacrificios de Dios son el espíritu quebrantado", confirmado: false });
    // El minuto es donde empieza la frase en la transcripción.
    expect(r[1].en).toBeCloseTo(44.8, 1);
  });

  test("como mucho 7", () => {
    const ps: Palabra[] = [];
    const cand: Candidata[] = [];
    for (let k = 0; k < 12; k++) {
      const ws = Array.from({ length: 8 }, (_, j) => `p${k}x${j}`);
      ws.forEach((t, j) => ps.push({ s: k * 20 + j * 0.5, e: k * 20 + j * 0.5 + 0.4, t }));
      cand.push({ texto: ws.join(" "), en: `${Math.floor((k * 20) / 60)}:${String((k * 20) % 60).padStart(2, "0")}` });
    }
    const r = elegirFrases(cand, ps, { inicio: 0, fin: 300 });
    expect(r).toHaveLength(7);
    expect(r.map((f) => f.en)).toEqual([...r.map((f) => f.en)].sort((a, b) => a - b));
  });

  test("todas inválidas → ninguna", () => {
    expect(elegirFrases([{ texto: "nada que ver con la prédica de hoy", en: "0:10" }, { texto: A, en: "x" }], palabras, rango)).toEqual([]);
  });
});

test("tamaño de letra según el largo", () => {
  expect(tamanoFrase("uno dos tres cuatro cinco seis")).toBe(96);
  expect(tamanoFrase(Array(25).fill("pal").join(" "))).toBe(56);
  expect(tamanoFrase(Array(16).fill("pal").join(" "))).toBe(77);
});

test("fiel: cambiar 3 de 10 palabras ya no es lo que dijo", () => {
  const f: Frase = { texto: A, en: 39, original: A, fondo: "marca" };
  expect(fiel(f)).toBe(true);
  expect(fiel({ ...f, texto: A.replace("terrenal", "terreno") })).toBe(true); // 1 de 10
  expect(fiel({ ...f, texto: "Y este dolor terrenal va a encender la gloria celestial" })).toBe(false);
});

describe("tarjeta", () => {
  const marca: Marca = { nombre: "Iglesia Familia", color: "#f5c542", invitacion: "", ...MARCA_PLAN3 };
  const base = { marca, predicador: "Pastor Juan", claves: ["quebrantamiento"], fondo: { tipo: "marca" as const }, fuentes: "file:///fuentes" };

  test("texto escapado, letra mínima con 25 palabras y sin scripts", () => {
    const texto = `Dijo "ven" <ahora> & ya ` + Array(21).fill("pal").join(" "); // 25 palabras (el & no cuenta)
    const html = htmlTarjetaFrase({ ...base, frase: { texto, en: 1, original: texto, fondo: "marca" } });
    expect(html).toContain("&quot;ven&quot; &lt;ahora&gt; &amp;");
    expect(html).toContain("font-size: 56px");
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("width: 1080px");
    expect(html).toContain("height: 1350px");
  });

  test("palabra clave en color, predicador y nombre de la iglesia", () => {
    const html = htmlTarjetaFrase({ ...base, frase: { texto: A, en: 39, original: A, fondo: "marca" } });
    expect(html).toContain(`<span class="clave">quebrantamiento</span>`);
    expect(html).toContain("Pastor Juan");
    expect(html).toContain("Iglesia Familia");
  });

  test("el versículo sale solo si está confirmado", () => {
    const v = { ref: "Salmos 51:17", texto: "Los sacrificios de Dios", confirmado: false };
    const sin = htmlTarjetaFrase({ ...base, frase: { texto: A, en: 39, original: A, fondo: "marca", versiculo: v } });
    expect(sin).not.toContain("Salmos 51:17");
    const con = htmlTarjetaFrase({ ...base, frase: { texto: A, en: 39, original: A, fondo: "marca", versiculo: { ...v, confirmado: true } } });
    expect(con).toContain("Salmos 51:17");
    expect(con).toContain("RVR1960");
  });

  test("fondo foto o pintura usa la imagen dada", () => {
    const foto = htmlTarjetaFrase({ ...base, fondo: { tipo: "momento", src: "file:///tmp/cuadro.jpg" }, frase: { texto: A, en: 39, original: A, fondo: "momento" } });
    expect(foto).toContain("file:///tmp/cuadro.jpg");
    expect(foto).toContain("blur(");
  });
});

test("la palabra clave de Claude se guarda solo si está en la frase", () => {
  const r = elegirFrases([{ texto: A, en: "0:39", clave: "gloria" }, { texto: D, en: "1:06", clave: "inventada" }], palabras, rango);
  expect(r[0].clave).toBe("gloria");
  expect(r[1].clave).toBeUndefined();
});
